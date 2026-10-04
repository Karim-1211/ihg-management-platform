import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../../services/api'
import { useAssistant } from '../../context/AssistantContext'
import { useAutoMic, narrateThenListen, streamAssistant } from '../../lib/aliceVoice'
import { useAliceRoomFlow } from '../../lib/useAliceRoomFlow'
import RecommendedRoomCard from '../customer/hospitality/RecommendedRoomCard'
import DiningConcierge from '../restaurants/DiningConcierge'

const ALICE_AVATAR_URL = 'https://images.unsplash.com/photo-1625726060119-83ad31838aca?fm=jpg&q=80&w=400&auto=format&fit=crop'

function AliceAvatar({ className = 'h-full w-full' }) {
  return (
    <img src={ALICE_AVATAR_URL} alt="Alice, your AI concierge" className={`object-cover ${className}`} style={{ objectPosition: 'center 22%' }} />
  )
}

function MinimizeIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h12" /></svg>
}
function CloseIcon({ className = 'w-4 h-4' }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
}
function SendIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
}
function MicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}
function BackIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
}

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hello, I'm Alice, your AI concierge. Ask me anything about your bookings, orders, reservations, invoices, or hotel policies — or let me know if you'd like help finding a room.",
}

const DINING_WELCOME = "Hello, I'm Alice, your dining concierge. I can reserve a table for you, or help you choose something delicious and have it delivered."
const DELIVERY_WELCOME = "Hello, I'm Alice, your delivery concierge. I can help you choose something delicious, tell you exactly where your order is, or answer any other question."

const SUBTITLES = { hotel: 'Your AI Concierge', dining: 'AI Dining Concierge', delivery: 'AI Delivery Concierge' }

// The red indicator above the message box, with a live bar that moves with
// the guest's voice. Whisper transcribes a finished recording, so there are
// no partial words to show while they speak — the bar is how they can see
// they're being heard.
function MicIndicator({ mic }) {
  if (mic.error) {
    return <p className="bg-white px-4 pt-2 text-center text-[11px] font-semibold text-amber-600">{mic.error}</p>
  }
  if (mic.transcribing) {
    return <p className="bg-white px-4 pt-2 text-center text-[11px] font-semibold text-[#FF2147]">✍️ Writing that down…</p>
  }
  if (!mic.listening) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-white px-4 pt-2">
      <span className="text-[11px] font-semibold text-[#FF2147]">🎙 Listening…</span>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
        <span
          className="block h-full rounded-full bg-[#FF2147] transition-[width] duration-75"
          style={{ width: `${Math.round((mic.level || 0) * 100)}%` }}
        />
      </span>
    </div>
  )
}

function MicButton({ mic }) {
  if (!mic.supported) return null
  return (
    <button
      type="button"
      onClick={() => (mic.listening ? mic.stop() : mic.start())}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
        mic.listening ? 'animate-pulse bg-[#FF2147] text-white' : 'bg-slate-100 text-[#1F3A5F] hover:bg-slate-200'
      }`}
      aria-label={mic.listening ? 'Stop listening' : 'Speak your answer'}
    >
      <MicIcon />
    </button>
  )
}

function isStaleDefaultWelcome(text) {
  return /guest assistant/i.test(text || '')
}

// Alice's role follows the page: delivery pages (menu, checkout, tracker,
// orders) → delivery concierge; restaurant pages → dining concierge;
// everywhere else → the hotel concierge.
function pageKindFor(pathname) {
  if (pathname.startsWith('/delivery')) return 'delivery'
  if (pathname.startsWith('/restaurants')) return 'dining'
  return 'hotel'
}

export default function CustomerAssistantWidget() {
  const { messages, setMessages, open, setOpen } = useAssistant()
  const location = useLocation()
  const pageKind = pageKindFor(location.pathname)

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const [showTeaser, setShowTeaser] = useState(false)
  const [teaserDismissed, setTeaserDismissed] = useState(false)
  const [mode, setMode] = useState('menu') // menu | chat | room | dining
  const [roomHotelId, setRoomHotelId] = useState(null)
  const [roomHotelError, setRoomHotelError] = useState('')
  const [dining, setDining] = useState(null) // { id, name, menu }
  const [diningError, setDiningError] = useState('')
  const [diningIntent, setDiningIntent] = useState(null)

  const scrollRef = useRef(null)
  const audioRef = useRef(null)
  const replyTextRef = useRef('')

  const chatMic = useAutoMic((transcript) => {
    if (!transcript) return
    chatMic.stop()
    submitMessage(transcript, true)
  })

  const roomFlow = useAliceRoomFlow({ hotelId: roomHotelId, active: mode === 'room' && !!roomHotelId })

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading, streamingText, open, mode, roomFlow.log, roomFlow.replyText])

  useEffect(() => {
    if (isStaleDefaultWelcome(messages?.[0]?.content) && messages.length === 1) {
      setMessages([WELCOME_MESSAGE])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Never carry one kind of conversation onto a different kind of page.
  useEffect(() => {
    setMode('menu')
  }, [pageKind])

  // Silence Alice whenever the page changes, however it changed — a link,
  // the back button, a form redirect. Previously she was only stopped when
  // the widget itself navigated, so a half-finished table booking kept
  // talking over the hotel checkout the guest had moved on to.
  useEffect(() => {
    chatMic.stop()
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (open || teaserDismissed) return
    const timer = window.setTimeout(() => setShowTeaser(true), 1500)
    return () => window.clearTimeout(timer)
  }, [open, teaserDismissed])

  useEffect(() => () => { chatMic.stop(); audioRef.current?.pause(); window.speechSynthesis?.cancel() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissTeaser() {
    setShowTeaser(false)
    setTeaserDismissed(true)
  }

  function openWidget() {
    dismissTeaser()
    setOpen(true)
  }

  function handleMinimize() {
    // A hidden window should never keep talking or listening.
    stopVoice()
    setOpen(false)
  }

  function stopVoice() {
    chatMic.stop()
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
    // The room-finding conversation has its own microphone and audio, which
    // this function never touched. Closing the window left Alice talking and
    // listening to an empty page.
    roomFlow.stopAll()
  }

  function handleClose() {
    setOpen(false)
    stopVoice()
    setMessages([WELCOME_MESSAGE])
    setMode('menu')
  }

  function backToMenu() {
    stopVoice()
    setMode('menu')
  }

  async function startFindRoom() {
    setError('')
    setRoomHotelError('')
    setMode('room')
    // This runs from a real click, which is what browsers require before
    // audio may play — so Alice can greet the guest aloud here.
    window.setTimeout(() => roomFlow.startVoice(), 150)
    if (roomHotelId) return
    try {
      const response = await api.get('/hotels')
      const hotels = response.data || []
      const preferred = hotels.find((h) => h.name === 'IHG Grand Dhaka') || hotels[0]
      if (!preferred) {
        setRoomHotelError("I'm sorry, no hotels are available to search right now.")
        return
      }
      setRoomHotelId(preferred.id)
    } catch {
      setRoomHotelError("I'm sorry, I couldn't reach the hotel directory just now. Please try again in a moment.")
    }
  }

  async function startDining(which) {
    setDiningError('')
    setDiningIntent(which)
    setMode('dining')
    if (dining) return
    try {
      const res = await api.get('/restaurants')
      const restaurant = (res.data || [])[0]
      if (!restaurant) {
        setDiningError("I'm sorry, the restaurant isn't available right now.")
        return
      }
      const menuRes = await api.get(`/restaurants/${restaurant.id}/menu`)
      setDining({ id: restaurant.id, name: restaurant.name, menu: Array.isArray(menuRes.data) ? menuRes.data : [] })
    } catch {
      setDiningError("I'm sorry, I couldn't reach the restaurant just now. Please try again in a moment.")
    }
  }

  function openAndStart(which) {
    openWidget()
    startDining(which)
  }

  function startAskQuestion() {
    setMode('chat')
  }

  async function submitMessage(value, viaVoice = false) {
    const trimmed = (value ?? input).trim()
    if (!trimmed || loading) return

    const userMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setError('')
    setLoading(true)
    replyTextRef.current = ''
    setStreamingText('')

    const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }))

    await streamAssistant({
      message: trimmed,
      conversationHistory: history,
      onDelta: (t) => { replyTextRef.current += t; setStreamingText(replyTextRef.current) },
      onDone: () => {
        const finalText = replyTextRef.current
        setLoading(false)
        setStreamingText('')
        setMessages([...newMessages, { role: 'assistant', content: finalText }])
        narrateThenListen(finalText, audioRef, true, () => { if (viaVoice) chatMic.start() })
      },
      onError: () => {
        setLoading(false)
        setStreamingText('')
        setError('The assistant is temporarily unavailable. Please try again shortly.')
        setMessages(newMessages)
      },
    })
  }

  function handleSend(e) {
    e.preventDefault()
    submitMessage()
  }

  const roomAllShown = [...roomFlow.primaryRooms, ...roomFlow.secondaryRooms]
  const menuButton = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-[13px] font-semibold text-[#1F3A5F] hover:bg-slate-50'

  return (
    <>
      {!open && showTeaser && (
        <div className="fixed bottom-40 right-6 z-[150] w-[280px] rounded-2xl bg-white p-4 shadow-[0_20px_48px_-8px_rgba(15,23,42,0.3)] ring-1 ring-slate-200/80">
          <button type="button" onClick={dismissTeaser} aria-label="Dismiss" className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white shadow hover:bg-slate-900">
            <CloseIcon className="h-3 w-3" />
          </button>

          {pageKind === 'delivery' && (
            <>
              <p className="text-sm leading-6 text-slate-700">
                Hi, I'm <span className="font-bold text-[#1F3A5F]">Alice</span> — hungry? I can help you choose, or tell you exactly where your order is.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openAndStart('choose')} className="rounded-xl bg-[#FF2147] py-2 text-[11px] font-bold text-white hover:bg-[#dc1539]">Help me choose</button>
                <button type="button" onClick={() => openAndStart('track')} className="rounded-xl bg-[#1F3A5F] py-2 text-[11px] font-bold text-white hover:bg-[#162f4d]">Track my order</button>
              </div>
            </>
          )}

          {pageKind === 'dining' && (
            <>
              <p className="text-sm leading-6 text-slate-700">
                Hi, I'm <span className="font-bold text-[#1F3A5F]">Alice</span> — shall I reserve you a table, or bring something delicious to your door?
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => openAndStart('reserve')} className="rounded-xl bg-[#FF2147] py-2 text-[11px] font-bold text-white hover:bg-[#dc1539]">Reserve a table</button>
                <button type="button" onClick={() => openAndStart('delivery')} className="rounded-xl bg-[#1F3A5F] py-2 text-[11px] font-bold text-white hover:bg-[#162f4d]">Order delivery</button>
              </div>
            </>
          )}

          {pageKind === 'hotel' && (
            <>
              <p className="text-sm leading-6 text-slate-700">
                Hi, I'm <span className="font-bold text-[#1F3A5F]">Alice</span> — need help finding a room, or a question about your stay?
              </p>
              <button type="button" onClick={openWidget} className="mt-3 w-full rounded-xl bg-[#FF2147] py-2 text-xs font-bold text-white hover:bg-[#dc1539]">
                Chat with Alice
              </button>
            </>
          )}
        </div>
      )}

      {!open && (
        <button type="button" onClick={openWidget} aria-label="Open assistant" className="fixed bottom-20 right-6 z-[150] flex h-16 w-16 items-center justify-center overflow-hidden rounded-full shadow-[0_8px_24px_rgba(31,58,95,0.4)] ring-2 ring-white transition-transform hover:scale-105">
          <AliceAvatar />
        </button>
      )}

      {open && (
        <div className="fixed bottom-20 right-6 z-[150] flex h-[min(600px,calc(100vh-6.5rem))] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-10px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between bg-gradient-to-r from-[#1F3A5F] to-[#132840] px-5 py-4">
            <div className="flex items-center gap-3">
              {mode !== 'menu' && (
                <button type="button" onClick={backToMenu} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Back">
                  <BackIcon />
                </button>
              )}
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/20">
                <AliceAvatar />
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Alice</p>
                <p className="text-[11px] text-white/50">{SUBTITLES[pageKind]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={handleMinimize} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Minimize assistant" title="Minimize">
                <MinimizeIcon />
              </button>
              <button type="button" onClick={handleClose} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close assistant and clear conversation" title="Close and clear conversation">
                <CloseIcon />
              </button>
            </div>
          </div>

          {mode === 'menu' && (
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
              <div className="max-w-[90%] rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] leading-relaxed text-slate-700">
                {pageKind === 'delivery' ? DELIVERY_WELCOME : pageKind === 'dining' ? DINING_WELCOME : (messages[0]?.content || WELCOME_MESSAGE.content)}
              </div>

              {pageKind === 'delivery' && (
                <>
                  <button type="button" onClick={() => startDining('choose')} className={menuButton}>✨ Ask Alice to choose</button>
                  <button type="button" onClick={() => startDining('track')} className={menuButton}>🛵 Track an order</button>
                  <button type="button" onClick={() => startDining('question')} className={menuButton}>💬 Ask me anything</button>
                </>
              )}

              {pageKind === 'dining' && (
                <>
                  <button type="button" onClick={() => startDining('reserve')} className={menuButton}>🍽️ Reserve a table</button>
                  <button type="button" onClick={() => startDining('delivery')} className={menuButton}>🛵 Order delivery</button>
                  <button type="button" onClick={() => startDining('question')} className={menuButton}>💬 Ask me anything</button>
                </>
              )}

              {pageKind === 'hotel' && (
                <>
                  <button type="button" onClick={startFindRoom} className={menuButton}>🛏️ Find me a room</button>
                  <button type="button" onClick={startAskQuestion} className={menuButton}>💬 Ask a question</button>
                  {messages.length > 1 && (
                    <button type="button" onClick={startAskQuestion} className="w-full text-center text-[12px] font-semibold text-slate-400 underline hover:text-slate-600">
                      Continue previous conversation
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {mode === 'dining' && (
            <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4">
              {diningError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{diningError}</div>}
              {!dining && !diningError && <p className="py-10 text-center text-[13px] text-slate-400">Alice is getting ready…</p>}
              {dining && (
                <DiningConcierge
                  compact
                  variant={pageKind === 'delivery' ? 'delivery' : 'restaurant'}
                  restaurantId={dining.id}
                  restaurantName={dining.name}
                  menu={dining.menu}
                  intent={diningIntent}
                  onIntentHandled={() => setDiningIntent(null)}
                  onBeforeNavigate={() => setOpen(false)}
                />
              )}
            </div>
          )}

          {mode === 'chat' && (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${m.role === 'user' ? 'bg-[#1F3A5F] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] leading-relaxed text-slate-700">
                      {streamingText}<span className="animate-pulse">▌</span>
                    </div>
                  </div>
                )}
                {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</div>}
              </div>

              <MicIndicator mic={chatMic} />

              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your booking, order..."
                  disabled={loading}
                  className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 disabled:opacity-50"
                />
                {chatMic.supported && (
                  <button
                    type="button"
                    onClick={() => (chatMic.listening ? chatMic.stop() : chatMic.start())}
                    disabled={loading}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${chatMic.listening ? 'animate-pulse bg-[#FF2147] text-white' : 'bg-slate-100 text-[#1F3A5F] hover:bg-slate-200'}`}
                    aria-label="Speak your question"
                  >
                    <MicIcon />
                  </button>
                )}
                <button type="submit" disabled={loading || !input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF2147] text-white transition-colors hover:bg-[#e01d3f] disabled:opacity-40" aria-label="Send message">
                  <SendIcon />
                </button>
              </form>
            </>
          )}

          {mode === 'room' && (
            <>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
                {roomHotelError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{roomHotelError}</div>}

                {roomFlow.log.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'alice' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${m.from === 'alice' ? 'border border-slate-200 bg-white text-slate-700' : 'bg-[#1F3A5F] text-white'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {roomFlow.streaming && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] whitespace-pre-line rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] leading-relaxed text-slate-700">
                      {roomFlow.replyText}<span className="animate-pulse">▌</span>
                    </div>
                  </div>
                )}
                {roomFlow.preparingVoice && <p className="text-center text-[11px] text-slate-400">🔊 Alice is preparing to speak…</p>}
                {roomFlow.error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{roomFlow.error}</div>}

                {roomFlow.primaryRooms.map((room) => (
                  <RecommendedRoomCard key={room.room_id} room={room} onBook={roomFlow.bookRoom} activeAudioRef={{ current: null }} compact />
                ))}
                {roomFlow.secondaryRooms.map((room) => (
                  <RecommendedRoomCard key={room.room_id} room={room} onBook={roomFlow.bookRoom} activeAudioRef={{ current: null }} compact />
                ))}
              </div>

              <MicIndicator mic={roomFlow.mic} />

              <div className="border-t border-slate-100 bg-white p-3">
                {roomFlow.step === 'preference' && (
                  <form onSubmit={(e) => { e.preventDefault(); roomFlow.submitPreferenceValue() }} className="flex gap-2">
                    <input value={roomFlow.preference} onChange={(e) => roomFlow.setPreference(e.target.value)} placeholder="A view, a balcony…" className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#1F3A5F]" />
                    <MicButton mic={roomFlow.mic} />
                    <button type="submit" disabled={!roomFlow.preference.trim()} className="rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Go</button>
                  </form>
                )}
                {roomFlow.step === 'checkin' && (
                  <form onSubmit={(e) => { e.preventDefault(); roomFlow.submitCheckInValue() }} className="flex gap-2">
                    <input required min={roomFlow.today} type="date" value={roomFlow.checkIn} onChange={(e) => roomFlow.setCheckIn(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#1F3A5F]" />
                    <MicButton mic={roomFlow.mic} /><button type="submit" disabled={!roomFlow.checkIn} className="rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Go</button>
                  </form>
                )}
                {roomFlow.step === 'checkout' && (
                  <form onSubmit={(e) => { e.preventDefault(); roomFlow.submitCheckOutValue() }} className="flex gap-2">
                    <input required min={roomFlow.checkIn || roomFlow.today} type="date" value={roomFlow.checkOut} onChange={(e) => roomFlow.setCheckOut(e.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#1F3A5F]" />
                    <MicButton mic={roomFlow.mic} /><button type="submit" disabled={!roomFlow.checkOut} className="rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Go</button>
                  </form>
                )}
                {roomFlow.step === 'guests' && (
                  <form onSubmit={(e) => { e.preventDefault(); roomFlow.submitGuestsValue() }} className="flex gap-2">
                    <select value={roomFlow.guests} onChange={(e) => roomFlow.setGuests(Number(e.target.value))} className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#1F3A5F]">
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
                    </select>
                    <MicButton mic={roomFlow.mic} /><button type="submit" className="rounded-xl bg-[#FF2147] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#dc1539]">Search</button>
                  </form>
                )}
                {roomFlow.step === 'searching' && <p className="text-center text-[12px] text-slate-400">Alice is checking availability…</p>}
                {roomFlow.step === 'results' && roomAllShown.length > 0 && (
                  <form onSubmit={(e) => { e.preventDefault(); roomFlow.submitConfirmValue() }} className="flex gap-2">
                    <input value={roomFlow.confirmText} onChange={(e) => roomFlow.setConfirmText(e.target.value)} placeholder='"yes" or a room number…' className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#1F3A5F]" />
                    <MicButton mic={roomFlow.mic} />
                    <button type="submit" disabled={!roomFlow.confirmText.trim()} className="rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Go</button>
                  </form>
                )}
                {roomFlow.step === 'results' && (
                  <button type="button" onClick={roomFlow.startOver} className="mt-2 w-full rounded-xl border border-slate-200 py-2 text-[12px] font-bold text-[#1F3A5F] hover:bg-slate-50">Start a new search</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}