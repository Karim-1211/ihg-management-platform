import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { requireAuth } from '../../lib/authRedirect'
import { useAutoMic, speakThenListen, narrateThenListen, streamAssistant } from '../../lib/aliceVoice'
import { addItemsToCart } from '../../lib/deliveryCart'
import { deliveryStepIndex, isFinished, statusLabel, statusPillClass, formatDateTime } from '../../lib/deliveryStatus'

const LINES = {
  greeting: { file: '/audio/alice-dining-greeting.wav', text: "Hello, I'm Alice. I can reserve a table for you, or help you find something delicious to eat. Which would you like?" },
  introReserve: { file: '/audio/alice-dining-intro-reserve.wav', text: "Hello, I'm Alice, your dining concierge. I'd be delighted to reserve a table for you. What date would you like to dine with us?" },
  introOrder: { file: '/audio/alice-dining-intro-order.wav', text: "Hello, I'm Alice, your dining concierge. I'd love to help you choose something delicious. Tell me what you're in the mood for, and I'll find it on our menu." },
  introDeliveryChoose: { file: '/audio/alice-delivery-intro-choose.wav', text: "Hello, I'm Alice, your delivery concierge. Tell me what you're in the mood for, and I'll find the perfect dish on our menu." },
  introDeliveryTrack: { file: '/audio/alice-delivery-intro-track.wav', text: "Hello, I'm Alice, your delivery concierge. One moment while I check on your order." },
  introDeliveryQuestion: { file: '/audio/alice-delivery-intro-question.wav', text: "Hello, I'm Alice, your delivery concierge. What would you like to know?" },
  introDiningQuestion: { file: '/audio/alice-dining-intro-question.wav', text: "Hello, I'm Alice, your dining concierge. What would you like to know?" },
  checkingOrder: { file: '/audio/alice-checking-order.wav', text: 'One moment while I check on your order.' },
  askQuestion: { file: '/audio/alice-ask-question.wav', text: 'Of course — what would you like to know?' },
  askDate: { file: '/audio/alice-ask-dining-date.wav', text: 'Lovely. What date would you like to dine with us?' },
  askTime: { file: '/audio/alice-ask-dining-time.wav', text: 'And what time shall I look for?' },
  askParty: { file: '/audio/alice-ask-party-size.wav', text: 'And how many guests will be joining you?' },
  checkingTables: { file: '/audio/alice-checking-tables.wav', text: 'One moment — let me check which tables are free for you.' },
  askCravings: { file: '/audio/alice-ask-cravings.wav', text: "Wonderful. Tell me what you're in the mood for, and I'll find something on the menu for you." },
  checkingMenu: { file: '/audio/alice-checking-menu.wav', text: 'Let me look through the menu for you.' },
  retryDate: { file: '/audio/alice-retry-dining-date.wav', text: "I didn't quite catch that date. When would you like to dine with us?" },
  retryTime: { file: '/audio/alice-retry-dining-time.wav', text: "I'm sorry, what time would you like?" },
  retryParty: { file: '/audio/alice-retry-party-size.wav', text: "I didn't catch that — how many guests will be joining you?" },
}

const DELIVERY_GREETING = "Hello, I'm Alice, your delivery concierge. I can help you choose something delicious, tell you exactly where your order is, or answer any other question."

// After this many answers in a row that Alice couldn't use, she stops
// reopening the microphone and hands over to the buttons and keyboard.
// A microphone that reopens forever after every unclear answer is how a
// conversation ends up carrying on by itself.
const MAX_UNCLEAR_IN_A_ROW = 2

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }
// Speech recognition regularly mishears small numbers as these words —
// "four guests" comes back as "for guests", "two" as "to".
const NUMBER_HOMOPHONES = { won: 1, to: 2, too: 2, tree: 3, for: 4, fore: 4, ate: 8, sex: 6, nun: 9 }

const ORDER_PHRASES = [
  'has been received and is waiting for the kitchen to confirm it',
  'has been confirmed by the kitchen',
  'is being prepared right now',
  'is ready and waiting for its rider',
  'is on its way to you',
  'has been delivered',
]

function guessYear(monthIndex, day) {
  const now = new Date()
  return new Date(now.getFullYear(), monthIndex, day) < now ? now.getFullYear() + 1 : now.getFullYear()
}

function isoDate(year, monthIndex, day) {
  const d = new Date(year, monthIndex, day)
  if (isNaN(d.getTime())) return null
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseSpokenDate(text) {
  const t = text.toLowerCase().trim()
  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))

  if (/\btoday\b/.test(t)) { const n = new Date(); return isoDate(n.getFullYear(), n.getMonth(), n.getDate()) }
  if (/\btomorrow\b/.test(t)) { const n = new Date(); n.setDate(n.getDate() + 1); return isoDate(n.getFullYear(), n.getMonth(), n.getDate()) }

  const slash = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (slash) {
    const mm = Number(slash[1]) - 1
    const dd = Number(slash[2])
    const yr = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : guessYear(mm, dd)
    return isoDate(yr, mm, dd)
  }
  for (let i = 0; i < MONTHS.length; i++) {
    if (t.includes(MONTHS[i]) || new RegExp(`\\b${MONTHS[i].slice(0, 3)}\\b`).test(t)) {
      const day = t.match(/\b(\d{1,2})(st|nd|rd|th)?\b/)
      if (day) {
        const yr = t.match(/\b(20\d{2})\b/)
        return isoDate(yr ? Number(yr[1]) : guessYear(i, Number(day[1])), i, Number(day[1]))
      }
    }
  }
  return null
}

function parseSpokenTime(text) {
  const t = text.toLowerCase().trim()
  const m = t.match(/(\d{1,2})[:.\s]?(\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?/)
  if (!m) return null
  let hour = Number(m[1])
  const minute = m[2] ? Number(m[2]) : 0
  const period = (m[3] || '').replace(/\./g, '')
  if (hour < 1 || hour > 23 || minute > 59) return null
  if (period === 'pm' && hour < 12) hour += 12
  if (period === 'am' && hour === 12) hour = 0
  if (!period && hour >= 1 && hour <= 10) hour += 12
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function normalise(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseSpokenParty(text) {
  const t = normalise(text)

  const digit = t.match(/\b(\d{1,2})\b/)
  if (digit) { const n = Number(digit[1]); if (n >= 1 && n <= 20) return n }

  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) return n
  }

  const beforeNoun = t.match(/\b([a-z]+)\s+(guests?|people|persons?|pax|of us)\b/)
  if (beforeNoun && NUMBER_HOMOPHONES[beforeNoun[1]] != null) return NUMBER_HOMOPHONES[beforeNoun[1]]

  if (NUMBER_HOMOPHONES[t] != null) return NUMBER_HOMOPHONES[t]
  return null
}

// Every table is "T" + a number, and speech recognition routinely mishears
// the letter — "T1" comes back as "D1", "P1", "E1", "tea one", "tee 1".
// So match on the NUMBER, whatever letter (if any) was heard with it.
function parseSpokenTable(text, tables) {
  if (!tables.length) return null
  const t = normalise(text)
  const squashed = t.replace(/\s+/g, '')

  for (const tb of tables) {
    const label = String(tb.table_number).toLowerCase().replace(/\s+/g, '')
    if (squashed.includes(label)) return tb
  }

  const byNumber = (n) => tables.find((tb) => Number(String(tb.table_number).replace(/\D/g, '')) === n) || null

  const digits = squashed.match(/(\d{1,2})/)
  if (digits) {
    const found = byNumber(Number(digits[1]))
    if (found) return found
  }

  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(t)) {
      const found = byNumber(n)
      if (found) return found
    }
  }

  const words = t.split(' ')
  const lastWord = words[words.length - 1]
  if (NUMBER_HOMOPHONES[lastWord] != null) {
    const found = byNumber(NUMBER_HOMOPHONES[lastWord])
    if (found) return found
  }

  if (/\b(first|1st)\b/.test(t)) return tables[0]
  if (/\b(second|2nd)\b/.test(t)) return tables[1] || null
  if (/\b(third|3rd)\b/.test(t)) return tables[2] || null
  if (/^(yes|yeah|yep|sure|ok|okay|that one|please)\b/.test(t) && tables.length === 1) return tables[0]
  return null
}

function prettyDateTime(dateStr, timeStr) {
  try {
    return new Date(`${dateStr}T${timeStr}:00`).toLocaleString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return `${dateStr} at ${timeStr}`
  }
}

// Order numbers are read aloud as their last four characters, spaced out,
// so the voice says "ending in 8 4 A E" instead of mangling "ORDED5984AE".
function orderSentence(order, spoken) {
  const index = deliveryStepIndex(order)
  const ref = spoken
    ? `ending in ${String(order.order_number || '').slice(-4).split('').join(' ')}`
    : order.order_number
  if (index === -1) return `Your order ${ref} was cancelled.`
  let sentence = `Your order ${ref} ${ORDER_PHRASES[index]}.`
  if (order.delivery_driver_name && index >= 3 && index < 5) {
    sentence += ` Your rider is ${order.delivery_driver_name.split(' ')[0]}.`
  }
  return sentence
}

// Order status comes straight from the guest's real orders — never from
// the language model — so it is instant and cannot be wrong.
function describeOrders(orders, spoken) {
  const active = orders.filter((o) => !isFinished(o))
  if (active.length === 1) {
    return { text: `${orderSentence(active[0], spoken)} You can follow every step on the live tracker.`, cards: active }
  }
  if (active.length > 1) {
    return {
      text: `You have ${active.length} orders on the way. ${active.slice(0, 3).map((o) => orderSentence(o, spoken)).join(' ')}`,
      cards: active.slice(0, 3),
    }
  }
  if (orders.length) {
    return {
      text: `You don't have anything on the way right now. ${orderSentence(orders[0], spoken)} Would you like me to help you choose something new?`,
      cards: [orders[0]],
    }
  }
  return { text: "You haven't placed a delivery order yet. Would you like me to help you choose something?", cards: [] }
}

// Finds which REAL menu items Alice actually named in her reply, by
// scanning the live menu — so "add it" can only ever add a dish that
// exists, never one the model invented.
function findMentionedItems(replyText, menu) {
  if (!replyText || !menu?.length) return []
  const haystack = replyText.toLowerCase()
  const found = []
  for (const category of menu) {
    for (const item of category.items || []) {
      if (!item.is_available) continue
      if (haystack.includes(item.name.toLowerCase())) found.push({ ...item, categoryName: category.name })
    }
  }
  return found
}

// After a main, suggest something to finish with; after a starter or
// dessert, suggest a drink. Deterministic, drawn from the real menu.
function pickUpsell(menu, cart, lastItem) {
  if (!menu?.length || !lastItem) return null
  const inCart = new Set(Object.keys(cart))
  const preferred = lastItem.categoryName === 'Mains' ? ['Desserts', 'Drinks'] : ['Drinks', 'Desserts']
  for (const wanted of preferred) {
    const category = menu.find((c) => c.name === wanted)
    if (!category) continue
    const pool = (category.items || []).filter((i) => i.is_available && !inCart.has(i.id))
    if (!pool.length) continue
    return { ...(pool.find((i) => i.is_signature) || pool[0]), categoryName: category.name }
  }
  return null
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'speaker') return <svg {...c}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
  if (name === 'muted') return <svg {...c}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
  if (name === 'mic') return <svg {...c}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
  return null
}

// The red indicator above the buttons. Whisper transcribes a finished
// recording, so there are no partial words to show while the guest speaks;
// the moving bar is how they can see they are being heard.
function MicStatus({ mic }) {
  if (mic.error) {
    return <p className="mt-3 text-center text-xs font-semibold text-amber-600">{mic.error}</p>
  }
  if (mic.transcribing) {
    return <p className="mt-3 text-center text-xs font-semibold text-[#FF2147]">✍️ Writing that down…</p>
  }
  if (!mic.listening) return null
  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <span className="text-xs font-semibold text-[#FF2147]">🎙 Listening…</span>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
        <span
          className="block h-full rounded-full bg-[#FF2147] transition-[width] duration-75"
          style={{ width: `${Math.round((mic.level || 0) * 100)}%` }}
        />
      </span>
    </div>
  )
}

// Lets the guest speak again after Alice has stopped listening.
function MicToggle({ mic }) {
  if (!mic.supported) return null
  return (
    <button
      type="button"
      onClick={() => (mic.listening ? mic.stop() : mic.start())}
      disabled={mic.transcribing}
      aria-label={mic.listening ? 'Stop listening' : 'Speak your answer'}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-50 ${
        mic.listening ? 'animate-pulse bg-[#FF2147] text-white' : 'bg-slate-100 text-[#1F3A5F] hover:bg-slate-200'
      }`}
    >
      <Icon name="mic" className="h-4 w-4" />
    </button>
  )
}

export default function DiningConcierge({
  restaurantId,
  restaurantName,
  menu = [],
  intent,
  onIntentHandled,
  compact = false,
  onBeforeNavigate,
  variant = 'restaurant',
}) {
  const isDelivery = variant === 'delivery'
  const greetingText = isDelivery ? DELIVERY_GREETING : LINES.greeting.text

  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const audioRef = useRef(null)
  const logRef = useRef(null)
  const stepRef = useRef('mode')
  const tablesRef = useRef([])
  const replyRef = useRef('')
  const introducedRef = useRef(false)
  const suggestedRef = useRef([])
  const menuRef = useRef([])
  const cartRef = useRef({})
  const historyRef = useRef([])
  // Answers in a row that Alice couldn't use. Reset by any answer she can.
  const unclearRef = useRef(0)
  // Incremented whenever a new request starts or the guest starts over; a
  // result that arrives for an older run is discarded instead of shown.
  const runRef = useRef(0)

  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [step, setStep] = useState('mode')
  const [orderMode, setOrderMode] = useState(isDelivery ? 'delivery' : 'dine')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [cravings, setCravings] = useState('')
  const [question, setQuestion] = useState('')
  const [tables, setTables] = useState([])
  const [tracked, setTracked] = useState([])
  const [cart, setCart] = useState({})
  const [suggested, setSuggested] = useState([])
  const [log, setLog] = useState([{ from: 'alice', text: greetingText }])
  const [replyText, setReplyText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const mic = useAutoMic((t) => handleVoice(t))

  useEffect(() => { stepRef.current = step }, [step])
  useEffect(() => { tablesRef.current = tables }, [tables])
  useEffect(() => { suggestedRef.current = suggested }, [suggested])
  useEffect(() => { menuRef.current = menu }, [menu])
  useEffect(() => { cartRef.current = cart }, [cart])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [log, replyText])

  // The concierge can be mounted inside the floating widget, which survives
  // a page change. Stop speaking and listening the moment the route changes,
  // so a reservation flow never follows the guest onto another page.
  useEffect(() => {
    runRef.current += 1
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    mic.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  useEffect(() => () => { audioRef.current?.pause(); window.speechSynthesis?.cancel(); mic.stop() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Deferred by one tick and cancelled on cleanup. React's development mode
  // runs mount effects twice; without this, a widget that mounts with an
  // intent already set would start Alice's introduction twice over.
  useEffect(() => {
    if (!intent) return undefined
    const timer = window.setTimeout(() => {
      if (intent === 'reserve') chooseReserve()
      else if (intent === 'order') chooseOrder(null, 'dine')
      else if (intent === 'delivery' || intent === 'choose') chooseOrder(null, 'delivery')
      else if (intent === 'track') startTrack()
      else if (intent === 'question') startQuestion()
      onIntentHandled?.()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent])

  // Menus, prices and table availability are public, so Alice helps
  // everyone. Only reserving, ordering and order-tracking need an account.
  const isStaff = !!user && user.role !== 'CUSTOMER'
  const today = new Date().toISOString().slice(0, 10)

  // Resolves only when the line has FINISHED playing naturally. If the line
  // is cancelled or replaced, it never resolves — so nothing waiting on it
  // can ever speak over, or open the mic during, whatever replaced it.
  function speakAndWait(line) {
    return new Promise((resolve) => {
      speakThenListen(line.file, line.text, audioRef, voiceEnabled, resolve)
    })
  }

  function speakLine(line) {
    speakAndWait(line).then(() => mic.start())
  }

  function stopAll() {
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    mic.stop()
  }

  function say(lineKey, nextStep) {
    mic.stop()
    if (nextStep) setStep(nextStep)
    const line = LINES[lineKey]
    setLog((l) => [...l, { from: 'alice', text: line.text }])
    speakLine(line)
  }

  // Says Alice couldn't use the guest's answer and listens again — but only
  // MAX_UNCLEAR_IN_A_ROW times, after which she hands over to the keyboard.
  function retryOrHandOver(lineKey) {
    unclearRef.current += 1
    if (unclearRef.current > MAX_UNCLEAR_IN_A_ROW) { handOverToKeyboard(); return }
    say(lineKey)
  }

  function handOverToKeyboard() {
    mic.stop()
    unclearRef.current = 0
    const line = "I'm having trouble catching that — please use the buttons or the box below, or tap the microphone to try again."
    setLog((l) => [...l, { from: 'alice', text: line }])
    narrateThenListen(line, audioRef, voiceEnabled, () => {})
  }

  // On first activation Alice introduces herself in the same clip as her
  // first question; after that she goes straight to the point.
  function begin(userText, introKey, followUpKey, nextStep) {
    mic.stop()
    runRef.current += 1
    unclearRef.current = 0
    const first = !introducedRef.current
    introducedRef.current = true
    setError('')
    setStep(nextStep)
    const line = LINES[first ? introKey : followUpKey]
    setLog((l) => [...(first ? [] : l), { from: 'user', text: userText }, { from: 'alice', text: line.text }])
    return speakAndWait(line)
  }

  function chooseReserve(heard) {
    begin(heard || 'Reserve a table', 'introReserve', 'askDate', 'date').then(() => mic.start())
  }

  function chooseOrder(heard, mode = 'dine') {
    setOrderMode(mode)
    const intro = isDelivery ? 'introDeliveryChoose' : 'introOrder'
    const label = heard || (isDelivery ? 'Help me choose' : mode === 'delivery' ? 'Order for delivery' : 'Help me choose a dish')
    begin(label, intro, 'askCravings', 'cravings').then(() => mic.start())
  }

  function startQuestion(heard) {
    const intro = isDelivery ? 'introDeliveryQuestion' : 'introDiningQuestion'
    begin(heard || 'Ask me anything', intro, 'askQuestion', 'question').then(() => mic.start())
  }

  async function startTrack(heard) {
    // Order tracking is the one delivery feature that needs an account —
    // it reads the guest's own orders.
    if (!user) {
      const line = "I'd love to check on your order — please sign in first and I'll pull it up straight away."
      setLog((l) => [...l, { from: 'user', text: heard || 'Track my order' }, { from: 'alice', text: line }])
      setStep('tracked')
      narrateThenListen(line, audioRef, voiceEnabled, () => {})
      window.setTimeout(() => {
        onBeforeNavigate?.()
        requireAuth(user, navigate, location, { reason: 'Sign in to track your delivery order.' })
      }, 2200)
      return
    }
    setTracked([])
    const spoken = begin(heard || 'Track my order', 'introDeliveryTrack', 'checkingOrder', 'tracking')
    const run = runRef.current

    let orders
    try {
      const res = await api.get('/orders/my')
      orders = (Array.isArray(res.data) ? res.data : []).filter((o) => o.order_type === 'DELIVERY')
    } catch {
      await spoken
      if (run !== runRef.current) return
      const message = "I couldn't reach your orders just now. Please try again in a moment."
      setStep('tracked')
      setLog((l) => [...l, { from: 'alice', text: message }])
      narrateThenListen(message, audioRef, voiceEnabled, () => {})
      return
    }
    if (run !== runRef.current) return

    const shown = describeOrders(orders, false)
    const said = describeOrders(orders, true)
    setTracked(shown.cards)

    await spoken
    if (run !== runRef.current) return
    setStep('tracked')
    setLog((l) => [...l, { from: 'alice', text: shown.text }])
    narrateThenListen(said.text, audioRef, voiceEnabled, () => mic.start())
  }

  async function askQuestion(text) {
    // Anything still being said is stopped first, so the answer can never
    // overlap an unfinished line.
    stopAll()
    runRef.current += 1
    unclearRef.current = 0
    const run = runRef.current
    setError('')
    setStep('answering')
    setLog((l) => [...l, { from: 'user', text }])
    replyRef.current = ''
    setReplyText('')
    setStreaming(true)

    await streamAssistant({
      message: text,
      conversationHistory: historyRef.current.slice(-8),
      onDelta: (d) => {
        if (run !== runRef.current) return
        replyRef.current += d
        setReplyText(replyRef.current)
      },
      onDone: () => {
        if (run !== runRef.current) return
        const final = replyRef.current
        setStreaming(false)
        setReplyText('')
        historyRef.current = [...historyRef.current, { role: 'user', content: text }, { role: 'assistant', content: final }]
        setLog((l) => [...l, { from: 'alice', text: final }])
        setStep('question')
        narrateThenListen(final, audioRef, voiceEnabled, () => mic.start())
      },
      onError: (m) => {
        if (run !== runRef.current) return
        setStreaming(false)
        setStep('question')
        setError(m)
      },
    })
  }

  function routeDeliveryIntent(transcript) {
    const t = transcript.toLowerCase()
    if (/(track|where|status|arriv|rider|how long|delivered)/.test(t)) { startTrack(transcript); return }
    if (/(choose|hungry|recommend|suggest|eat|food|dish|menu|something to)/.test(t)) { chooseOrder(transcript, 'delivery'); return }
    askQuestion(transcript)
  }

  function handleVoice(transcript) {
    if (!transcript) return
    const s = stepRef.current

    if (s === 'mode' || s === 'tracked') {
      if (isDelivery) { routeDeliveryIntent(transcript); return }
      if (/\b(table|reserve|reservation|book|booking)\b/i.test(transcript)) { chooseReserve(transcript); return }
      if (/\b(deliver|delivery)\b/i.test(transcript)) { chooseOrder(transcript, 'delivery'); return }
      if (/\b(food|eat|order|menu|hungry|dish|dinner|lunch)\b/i.test(transcript)) { chooseOrder(transcript, 'dine'); return }
      return
    }
    if (s === 'question') {
      askQuestion(transcript)
      return
    }
    if (s === 'date') {
      const p = parseSpokenDate(transcript)
      if (p) { unclearRef.current = 0; setDate(p); setLog((l) => [...l, { from: 'user', text: transcript }]); window.setTimeout(() => say('askTime', 'time'), 400) }
      else retryOrHandOver('retryDate')
      return
    }
    if (s === 'time') {
      const p = parseSpokenTime(transcript)
      if (p) { unclearRef.current = 0; setTime(p); setLog((l) => [...l, { from: 'user', text: transcript }]); window.setTimeout(() => say('askParty', 'party'), 400) }
      else retryOrHandOver('retryTime')
      return
    }
    if (s === 'party') {
      const p = parseSpokenParty(transcript)
      if (p) { unclearRef.current = 0; setPartySize(p); setLog((l) => [...l, { from: 'user', text: transcript }]); window.setTimeout(() => findTables(p), 400) }
      else retryOrHandOver('retryParty')
      return
    }
    if (s === 'tables') {
      const match = parseSpokenTable(transcript, tablesRef.current)
      setLog((l) => [...l, { from: 'user', text: transcript }])
      if (match) {
        unclearRef.current = 0
        mic.stop()
        const line = `Taking you through to reserve table ${match.table_number}.`
        setLog((l) => [...l, { from: 'alice', text: line }])
        narrateThenListen(line, audioRef, voiceEnabled, () => {})
        window.setTimeout(() => goReserve(match), 900)
      } else {
        unclearRef.current += 1
        if (unclearRef.current > MAX_UNCLEAR_IN_A_ROW) { handOverToKeyboard(); return }
        const numbers = tablesRef.current.slice(0, 4).map((tb) => tb.table_number).join(', ')
        const line = `I didn't catch which table. You can say the number — for example ${numbers} — or tap one below.`
        setLog((l) => [...l, { from: 'alice', text: line }])
        narrateThenListen(line, audioRef, voiceEnabled, () => mic.start())
      }
      return
    }
    if (s === 'cravings') {
      setCravings(transcript)
      askMenu(transcript)
      return
    }
    if (s === 'offer' || s === 'upsell') {
      setLog((l) => [...l, { from: 'user', text: transcript }])
      handleOfferReply(transcript)
    }
  }

  function handleOfferReply(transcript) {
    const t = transcript.toLowerCase()
    const options = suggestedRef.current

    if (/\b(that'?s all|thats all|no thanks|nothing else|that is all|done|finish|check ?out|nope|no more)\b/.test(t)) {
      goToOrder()
      return
    }

    const named = options.find((i) => t.includes(i.name.toLowerCase()))
      || (/(yes|yeah|yep|sure|please|i want it|add it|go on|ok|okay|sounds good|i'll have|i will have)/.test(t) ? options[0] : null)

    if (named) { addToCart(named); return }

    if (/\b(something different|something else|another|different)\b/.test(t)) {
      unclearRef.current = 0
      say('askCravings', 'cravings')
      return
    }

    // Alice didn't understand. This line used to reopen the microphone
    // every single time — the loop that kept the chat talking to itself.
    unclearRef.current += 1
    if (unclearRef.current > MAX_UNCLEAR_IN_A_ROW) { handOverToKeyboard(); return }
    const line = "Of course — just say \"add it\", name the dish you'd like, or say \"that's all\" and I'll take you to checkout."
    setLog((l) => [...l, { from: 'alice', text: line }])
    narrateThenListen(line, audioRef, voiceEnabled, () => mic.start())
  }

  function addToCart(item) {
    mic.stop()
    unclearRef.current = 0
    const nextCart = { ...cartRef.current, [item.id]: (cartRef.current[item.id] || 0) + 1 }
    setCart(nextCart)
    cartRef.current = nextCart

    const upsell = pickUpsell(menuRef.current, nextCart, item)
    const line = upsell
      ? `Wonderful — I've added the ${item.name} to your order. To go alongside it, may I suggest the ${upsell.name}? Or simply say "that's all" and I'll take you through to checkout.`
      : `Wonderful — I've added the ${item.name} to your order. Would you like anything else, or shall I take you through to checkout?`

    setSuggested(upsell ? [upsell] : [])
    suggestedRef.current = upsell ? [upsell] : []
    setStep('upsell')
    setLog((l) => [...l, { from: 'alice', text: line }])
    narrateThenListen(line, audioRef, voiceEnabled, () => mic.start())
  }

  function removeFromCart(itemId) {
    const next = { ...cartRef.current }
    delete next[itemId]
    setCart(next)
    cartRef.current = next
  }

  // Alice's picks go into the shared delivery basket, so they carry
  // straight through to checkout — and survive the sign-in step.
  function goToOrder() {
    stopAll()
    if (!Object.keys(cartRef.current).length) {
      onBeforeNavigate?.()
      navigate('/delivery')
      return
    }
    addItemsToCart(restaurantId, cartRef.current)
    const line = 'Lovely — taking you through to checkout.'
    setLog((l) => [...l, { from: 'alice', text: line }])
    narrateThenListen(line, audioRef, voiceEnabled, () => {})
    window.setTimeout(() => {
      onBeforeNavigate?.()
      navigate('/delivery/checkout')
    }, 1200)
  }

  function openTracker(orderId) {
    stopAll()
    onBeforeNavigate?.()
    navigate(`/delivery/orders/${orderId}`)
  }

  function viewFullMenu() {
    const el = document.getElementById('the-menu')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    } else {
      onBeforeNavigate?.()
      navigate(isDelivery ? '/delivery' : '/restaurants')
    }
  }

  const cartItems = Object.entries(cart).map(([id, qty]) => {
    for (const c of menu) {
      const found = (c.items || []).find((i) => i.id === id)
      if (found) return { ...found, qty }
    }
    return null
  }).filter(Boolean)

  const cartTotal = cartItems.reduce((sum, i) => sum + Number(i.price) * i.qty, 0)

  // Availability comes straight from the real endpoint — the same overlap
  // check the booking service enforces — so a table shown here is genuinely
  // bookable, with no model latency and no invented tables.
  async function findTables(party) {
    mic.stop()
    runRef.current += 1
    const run = runRef.current
    setError('')
    setStep('searching')
    setLog((l) => [...l, { from: 'alice', text: LINES.checkingTables.text }])
    const lineDone = speakAndWait(LINES.checkingTables)
    setBusy(true)
    try {
      const res = await api.get(`/restaurants/${restaurantId}/tables/available`, {
        params: { reservation_start: `${date}T${time}:00`, party_size: party },
      })
      if (run !== runRef.current) return
      const found = Array.isArray(res.data) ? res.data : []
      setTables(found)
      tablesRef.current = found

      const when = prettyDateTime(date, time)
      const spoken = found.length === 0
        ? `I'm sorry — we have nothing free for ${party} on ${when}. Would you like me to try a different time?`
        : found.length === 1
          ? `Good news — table ${found[0].table_number} is free on ${when}, seating up to ${found[0].capacity}. Shall I take you through to reserve it?`
          : `I found ${found.length} tables free on ${when}. ${found.slice(0, 3).map((tb) => `Table ${tb.table_number} seats ${tb.capacity}`).join(', ')}. Which would you prefer?`

      await lineDone
      if (run !== runRef.current) return
      setStep('tables')
      setLog((l) => [...l, { from: 'alice', text: spoken }])
      narrateThenListen(spoken, audioRef, voiceEnabled, () => mic.start())
    } catch (err) {
      if (run !== runRef.current) return
      const message = err.response?.data?.detail || "I couldn't check availability just now. Please try again in a moment."
      setError(message)
      setStep('party')
      setLog((l) => [...l, { from: 'alice', text: message }])
    } finally {
      setBusy(false)
    }
  }

  async function askMenu(text) {
    mic.stop()
    runRef.current += 1
    unclearRef.current = 0
    const run = runRef.current
    setError('')
    setStep('menuSearching')
    setLog((l) => [...l, { from: 'user', text }, { from: 'alice', text: LINES.checkingMenu.text }])
    const lineDone = speakAndWait(LINES.checkingMenu)

    replyRef.current = ''
    setReplyText('')
    setStreaming(true)

    await streamAssistant({
      message: `I'm ordering from ${restaurantName} (restaurant_id: ${restaurantId}). I'm in the mood for: ${text}. Please recommend two or three dishes from the menu.`,
      onDelta: (d) => {
        if (run !== runRef.current) return
        replyRef.current += d
        setReplyText(replyRef.current)
      },
      onDone: async () => {
        if (run !== runRef.current) return
        const final = replyRef.current
        setStreaming(false)
        setReplyText('')
        setLog((l) => [...l, { from: 'alice', text: final }])

        const mentioned = findMentionedItems(final, menuRef.current)
        setSuggested(mentioned)
        suggestedRef.current = mentioned

        const offer = mentioned.length === 1
          ? `Shall I add the ${mentioned[0].name} to your order? Just say "add it" — or tell me if you'd prefer something different.`
          : 'Shall I add one of those to your order? Just name the dish you would like — or tell me if you would prefer something different.'

        if (mentioned.length) {
          setStep('offer')
          setLog((l) => [...l, { from: 'alice', text: offer }])
        } else {
          setStep('menuDone')
        }

        // Wait for "Let me look through the menu" to finish before the
        // answer starts, so one line never cuts off another.
        await lineDone
        if (run !== runRef.current) return
        narrateThenListen(mentioned.length ? `${final} ${offer}` : final, audioRef, voiceEnabled, () => mic.start())
      },
      onError: (m) => {
        if (run !== runRef.current) return
        setStreaming(false)
        setStep('cravings')
        setError(m)
      },
    })
  }

  function goReserve(table) {
    stopAll()
    const params = new URLSearchParams({ tableId: table.id, date, time, partySize: String(partySize) })
    const target = `/restaurants/${restaurantId}/reserve?${params.toString()}`
    onBeforeNavigate?.()
    if (!requireAuth(user, navigate, location, {
      from: target,
      reason: `Please sign in to confirm your table. Table ${table.table_number} and your time are saved.`,
    })) return
    navigate(target)
  }

  function restart() {
    stopAll()
    runRef.current += 1
    unclearRef.current = 0
    setStep('mode')
    setTables([])
    setTracked([])
    setCravings('')
    setQuestion('')
    setSuggested([])
    setCart({})
    cartRef.current = {}
    historyRef.current = []
    setStreaming(false)
    setReplyText('')
    setError('')
    setLog([{ from: 'alice', text: greetingText }])
  }

  function toggleVoice() {
    if (voiceEnabled) { audioRef.current?.pause(); window.speechSynthesis?.cancel() }
    setVoiceEnabled((v) => !v)
  }

  if (isStaff) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          The {isDelivery ? 'delivery' : 'dining'} concierge is available on guest accounts.
        </p>
      </div>
    )
  }

  const cols2 = compact ? 'grid-cols-1' : 'sm:grid-cols-2'
  const cols3 = compact ? 'grid-cols-2' : 'sm:grid-cols-3'
  const btn = compact ? 'px-4 py-2.5 text-[13px]' : 'px-6 py-3 text-sm'
  const field = compact ? 'px-3 py-2.5 text-[13px]' : 'px-4 py-3 text-sm'
  const optionBtn = 'rounded-xl border border-slate-200 bg-white px-5 py-4 text-left text-sm font-bold text-[#1F3A5F] transition hover:border-[#1F3A5F]/30 hover:bg-slate-50'

  const body = (
    <>
      <div ref={logRef} className={`space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4 ${compact ? 'max-h-[230px]' : 'mt-6 max-h-[320px]'}`}>
        {log.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'alice' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 leading-6 ${compact ? 'text-[13px]' : 'text-sm'} ${m.from === 'alice' ? 'bg-white text-slate-700 ring-1 ring-slate-200' : 'bg-[#1F3A5F] text-white'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl bg-white px-4 py-2.5 leading-6 text-slate-700 ring-1 ring-slate-200 ${compact ? 'text-[13px]' : 'text-sm'}`}>
              {replyText || 'Thinking…'}<span className="animate-pulse">▌</span>
            </div>
          </div>
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Your order so far</p>
          <div className="mt-2.5 space-y-1.5">
            {cartItems.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{i.qty} × {i.name}</span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-[#1F3A5F]">${(Number(i.price) * i.qty).toFixed(2)}</span>
                  <button type="button" onClick={() => removeFromCart(i.id)} className="text-xs text-slate-400 hover:text-[#FF2147]" aria-label={`Remove ${i.name}`}>×</button>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-2.5 text-sm font-bold text-[#1F3A5F]">
            <span>Subtotal</span><span>${cartTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <MicStatus mic={mic} />

      <div className="mt-4">
        {step === 'mode' && isDelivery && (
          <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-3'}`}>
            <button type="button" onClick={() => chooseOrder(null, 'delivery')} className={optionBtn}>✨ Ask Alice to choose</button>
            <button type="button" onClick={() => startTrack()} className={optionBtn}>🛵 Track an order</button>
            <button type="button" onClick={() => startQuestion()} className={optionBtn}>💬 Ask me anything</button>
          </div>
        )}

        {step === 'mode' && !isDelivery && (
          <div className={`grid gap-3 ${cols2}`}>
            <button type="button" onClick={() => chooseReserve()} className={optionBtn}>🍽️ Reserve a table</button>
            <button type="button" onClick={() => chooseOrder(null, 'delivery')} className={optionBtn}>🛵 Order delivery</button>
          </div>
        )}

        {step === 'tracking' && <p className="text-center text-sm text-slate-400">Alice is checking your orders…</p>}

        {step === 'tracked' && (
          <>
            {tracked.length > 0 && (
              <div className="space-y-2">
                {tracked.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1F3A5F]">Order {o.order_number}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(o.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${statusPillClass(o)}`}>{statusLabel(o)}</span>
                      <button type="button" onClick={() => openTracker(o.id)} className="text-xs font-bold text-[#FF2147] hover:underline">Track →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className={`mt-3 grid gap-2 ${cols2}`}>
              <button type="button" onClick={() => startTrack('Check again')} className="rounded-xl border border-slate-300 py-3 text-sm font-bold text-[#1F3A5F] hover:bg-slate-50">Check again</button>
              <button type="button" onClick={() => chooseOrder(null, 'delivery')} className="rounded-xl bg-[#FF2147] py-3 text-sm font-bold text-white hover:bg-[#dc1539]">Help me choose</button>
            </div>
          </>
        )}

        {step === 'question' && (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const q = question.trim()
                if (!q) return
                setQuestion('')
                askQuestion(q)
              }}
              className="flex gap-2"
            >
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask Alice anything…" className={`flex-1 rounded-xl border border-slate-300 outline-none focus:border-[#1F3A5F] ${field}`} />
              <MicToggle mic={mic} />
              <button type="submit" disabled={!question.trim()} className={`rounded-xl bg-[#1F3A5F] font-bold text-white hover:bg-[#162f4d] disabled:opacity-50 ${btn}`}>Ask</button>
            </form>
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs font-bold text-[#1F3A5F]">
              {isDelivery ? (
                <>
                  <button type="button" onClick={() => chooseOrder(null, 'delivery')} className="underline-offset-4 hover:underline">Help me choose</button>
                  <button type="button" onClick={() => startTrack()} className="underline-offset-4 hover:underline">Track my order</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => chooseReserve()} className="underline-offset-4 hover:underline">Reserve a table</button>
                  <button type="button" onClick={() => chooseOrder(null, 'delivery')} className="underline-offset-4 hover:underline">Order delivery</button>
                </>
              )}
            </div>
          </>
        )}

        {step === 'answering' && <p className="text-center text-sm text-slate-400">Alice is thinking…</p>}

        {step === 'date' && (
          <form onSubmit={(e) => { e.preventDefault(); if (date) { setLog((l) => [...l, { from: 'user', text: date }]); say('askTime', 'time') } }} className="flex gap-2">
            <input required min={today} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`flex-1 rounded-xl border border-slate-300 outline-none focus:border-[#1F3A5F] ${field}`} />
            <MicToggle mic={mic} />
            <button type="submit" disabled={!date} className={`rounded-xl bg-[#1F3A5F] font-bold text-white hover:bg-[#162f4d] disabled:opacity-50 ${btn}`}>Continue</button>
          </form>
        )}

        {step === 'time' && (
          <form onSubmit={(e) => { e.preventDefault(); if (time) { setLog((l) => [...l, { from: 'user', text: time }]); say('askParty', 'party') } }} className="flex gap-2">
            <input required type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`flex-1 rounded-xl border border-slate-300 outline-none focus:border-[#1F3A5F] ${field}`} />
            <MicToggle mic={mic} />
            <button type="submit" disabled={!time} className={`rounded-xl bg-[#1F3A5F] font-bold text-white hover:bg-[#162f4d] disabled:opacity-50 ${btn}`}>Continue</button>
          </form>
        )}

        {step === 'party' && (
          <form onSubmit={(e) => { e.preventDefault(); setLog((l) => [...l, { from: 'user', text: `${partySize} guests` }]); findTables(partySize) }} className="flex gap-2">
            <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className={`flex-1 rounded-xl border border-slate-300 outline-none focus:border-[#1F3A5F] ${field}`}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
            </select>
            <MicToggle mic={mic} />
            <button type="submit" className={`rounded-xl bg-[#FF2147] font-bold text-white hover:bg-[#dc1539] ${btn}`}>Find tables</button>
          </form>
        )}

        {(step === 'searching' || step === 'menuSearching') && (
          <p className="text-center text-sm text-slate-400">{busy || streaming ? 'Alice is checking…' : ''}</p>
        )}

        {step === 'cravings' && (
          <form onSubmit={(e) => { e.preventDefault(); if (cravings.trim()) askMenu(cravings.trim()) }} className="flex gap-2">
            <input value={cravings} onChange={(e) => setCravings(e.target.value)} placeholder="e.g. something spicy and vegetarian" className={`flex-1 rounded-xl border border-slate-300 outline-none focus:border-[#1F3A5F] ${field}`} />
            <MicToggle mic={mic} />
            <button type="submit" disabled={!cravings.trim()} className={`rounded-xl bg-[#FF2147] font-bold text-white hover:bg-[#dc1539] disabled:opacity-50 ${btn}`}>Ask</button>
          </form>
        )}

        {step === 'tables' && tables.length > 0 && (
          <div className={`grid gap-2 ${cols3}`}>
            {tables.slice(0, 6).map((tb) => (
              <button key={tb.id} type="button" onClick={() => goReserve(tb)} className="rounded-xl border border-slate-200 bg-white p-3.5 text-left hover:border-[#FF2147]/40 hover:bg-red-50/40">
                <p className="text-base font-bold text-[#1F3A5F]">Table {tb.table_number}</p>
                <p className="mt-0.5 text-xs text-slate-500">Seats up to {tb.capacity}</p>
                <p className="mt-2 text-xs font-bold text-[#FF2147]">Reserve →</p>
              </button>
            ))}
          </div>
        )}

        {(step === 'offer' || step === 'upsell') && (
          <>
            {suggested.length > 0 && (
              <div className={`grid gap-2 ${cols2}`}>
                {suggested.slice(0, 4).map((item) => (
                  <button key={item.id} type="button" onClick={() => addToCart(item)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-[#FF2147]/40 hover:bg-red-50/40">
                    <span>
                      <span className="block text-sm font-bold text-[#1F3A5F]">{item.name}</span>
                      <span className="block text-xs text-slate-500">${Number(item.price).toFixed(2)}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[#FF2147]">Add +</span>
                  </button>
                ))}
              </div>
            )}
            <div className={`mt-3 grid gap-2 ${cols2}`}>
              <button type="button" onClick={() => say('askCravings', 'cravings')} className="rounded-xl border border-slate-300 py-3 text-sm font-bold text-[#1F3A5F] hover:bg-slate-50">Something different</button>
              <button type="button" onClick={goToOrder} className="rounded-xl bg-[#FF2147] py-3 text-sm font-bold text-white hover:bg-[#dc1539]">
                {cartItems.length ? "That's all — checkout" : 'Go to the menu'}
              </button>
            </div>
          </>
        )}

        {step === 'menuDone' && (
          <div className={`grid gap-2 ${cols2}`}>
            <button type="button" onClick={viewFullMenu} className="rounded-xl bg-[#1F3A5F] px-5 py-3 text-sm font-bold text-white hover:bg-[#162f4d]">View full menu</button>
            <button type="button" onClick={() => say('askCravings', 'cravings')} className="rounded-xl bg-[#FF2147] px-5 py-3 text-sm font-bold text-white hover:bg-[#dc1539]">
              {orderMode === 'delivery' ? 'Try something else' : 'Ask again'}
            </button>
          </div>
        )}

        {['tables', 'menuDone', 'offer', 'upsell', 'tracked', 'question'].includes(step) && (
          <button type="button" onClick={restart} className="mt-3 w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-[#1F3A5F] hover:bg-slate-50">Start over</button>
        )}
      </div>
    </>
  )

  if (compact) {
    return (
      <div>
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={toggleVoice} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
            <Icon name={voiceEnabled ? 'speaker' : 'muted'} className="h-3 w-3" />
            {voiceEnabled ? 'Voice on' : 'Voice off'}
          </button>
        </div>
        {body}
      </div>
    )
  }

  return (
    <div id="dining-concierge-card" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF2147]">
            {isDelivery ? 'AI Delivery Concierge' : 'AI Dining Concierge'}
          </p>
          <h3 className="mt-2 text-2xl font-bold text-[#1F3A5F]">
            {isDelivery ? 'Choose, track or ask with Alice' : 'Reserve or order with Alice'}
          </h3>
        </div>
        <button type="button" onClick={toggleVoice} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">
          <Icon name={voiceEnabled ? 'speaker' : 'muted'} className="h-3.5 w-3.5" />
          {voiceEnabled ? 'Voice on' : 'Voice off'}
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {isDelivery
          ? "She recommends real dishes from tonight's menu, tells you exactly where your order is, and answers anything else — speak naturally or type."
          : 'Tell her what you need — she checks real table availability and reads the real menu. Speak naturally or type.'}
      </p>
      {body}
    </div>
  )
}