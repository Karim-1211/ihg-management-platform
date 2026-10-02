import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requireAuth } from './authRedirect'
import { useAutoMic, speakThenListen, narrateThenListen, streamAssistant } from './aliceVoice'

export const ALICE_ROOM_LINES = {
  greeting: {
    file: '/audio/alice-greeting.wav',
    text: "Hello, I'm Alice, your personal hotel concierge. I'm here to help you find the room you'll love. Tell me what you're looking for — a view, a balcony, a quiet floor, anything that matters to you.",
  },
  askCheckin: { file: '/audio/alice-ask-checkin.wav', text: 'Got it. What date would you like to check in?' },
  askCheckout: { file: '/audio/alice-ask-checkout.wav', text: 'And what date would you like to check out?' },
  askGuests: { file: '/audio/alice-ask-guests.wav', text: 'And how many guests will be staying?' },
  checking: { file: '/audio/alice-checking.wav', text: "Thank you. I'm checking the available rooms that match your preferences." },
  startOver: { file: '/audio/alice-start-over.wav', text: "Sure — tell me what you're looking for this time." },
  retryPreference: { file: '/audio/alice-retry-preference.wav', text: "I'm sorry, I didn't quite catch that. Could you tell me a little more about what you're looking for in a room?" },
  retryCheckin: { file: '/audio/alice-retry-checkin.wav', text: "I didn't quite catch that date. Could you tell me your check-in date again?" },
  retryCheckout: { file: '/audio/alice-retry-checkout.wav', text: "I'm sorry, what date would you like to check out?" },
  retryGuests: { file: '/audio/alice-retry-guests.wav', text: "I didn't catch that — how many guests will be staying?" },
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }

function guessYear(monthIndex, day) {
  const now = new Date()
  const candidate = new Date(now.getFullYear(), monthIndex, day)
  return candidate < now ? now.getFullYear() + 1 : now.getFullYear()
}

function isoDate(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day)
  if (isNaN(date.getTime())) return null
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseSpokenDate(text) {
  const normalized = text.toLowerCase().trim()

  const isoMatch = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))

  const slashMatch = normalized.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (slashMatch) {
    const mm = Number(slashMatch[1]) - 1
    const dd = Number(slashMatch[2])
    const year = slashMatch[3] ? (slashMatch[3].length === 2 ? 2000 + Number(slashMatch[3]) : Number(slashMatch[3])) : guessYear(mm, dd)
    return isoDate(year, mm, dd)
  }

  for (let i = 0; i < MONTHS.length; i++) {
    const abbrev = MONTHS[i].slice(0, 3)
    if (normalized.includes(MONTHS[i]) || new RegExp(`\\b${abbrev}\\b`).test(normalized)) {
      const dayMatch = normalized.match(/\b(\d{1,2})(st|nd|rd|th)?\b/)
      if (dayMatch) {
        const day = Number(dayMatch[1])
        const yearMatch = normalized.match(/\b(20\d{2})\b/)
        const year = yearMatch ? Number(yearMatch[1]) : guessYear(i, day)
        return isoDate(year, i, day)
      }
    }
  }
  return null
}

function parseSpokenGuests(text) {
  const normalized = text.toLowerCase()
  const digitMatch = normalized.match(/\d+/)
  if (digitMatch) return Math.min(6, Math.max(1, parseInt(digitMatch[0], 10)))
  for (const word of Object.keys(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) return NUMBER_WORDS[word]
  }
  return null
}

function looksLikeRealPreference(text) {
  return text.trim().split(/\s+/).filter(Boolean).length >= 2
}

function matchRoomFromText(text, rooms) {
  const normalized = text.trim().toLowerCase()
  if (!normalized || !rooms.length) return null
  if (/^(yes|yeah|yep|sure|okay|ok|please|book it|that one|go ahead|correct)\b/.test(normalized) && rooms.length === 1) {
    return rooms[0]
  }
  const byNumber = rooms.find((r) => normalized.includes(String(r.room_number).toLowerCase()))
  if (byNumber) return byNumber
  const byType = rooms.find((r) => r.room_type && normalized.includes(r.room_type.toLowerCase()))
  if (byType) return byType
  return null
}

// The complete Alice room-finding conversation, as one reusable engine.
// `active` lets a caller mount this hook unconditionally (Rules of Hooks)
// while only actually starting the conversation once ready — e.g. the
// sitewide widget waits until it has resolved a real hotelId before
// setting active=true.
export function useAliceRoomFlow({ hotelId, defaultCheckIn = '', defaultCheckOut = '', defaultGuests = 2, active = true }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const activeAudioRef = useRef(null)
  const replyTextRef = useRef('')
  const hasStartedRef = useRef(false)
  const stepRef = useRef('preference')

  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [step, setStep] = useState('preference')
  const [preference, setPreference] = useState('')
  const [checkIn, setCheckIn] = useState(defaultCheckIn)
  const [checkOut, setCheckOut] = useState(defaultCheckOut)
  const [guests, setGuests] = useState(defaultGuests)
  const [confirmText, setConfirmText] = useState('')
  const [log, setLog] = useState([])
  const [replyText, setReplyText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [preparingVoice, setPreparingVoice] = useState(false)
  const [error, setError] = useState('')
  const [primaryRooms, setPrimaryRooms] = useState([])
  const [secondaryRooms, setSecondaryRooms] = useState([])
  const [note, setNote] = useState('')

  const mic = useAutoMic((transcript) => handleVoiceResult(transcript))

  useEffect(() => { stepRef.current = step }, [step])
  useEffect(() => () => { activeAudioRef.current?.pause(); window.speechSynthesis?.cancel(); mic.stop() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Greeting TEXT appears immediately, but voice waits for the guest's
  // first click. Browsers block audio that hasn't followed a user
  // interaction, so an auto-greeting silently fails and falls back to the
  // browser's own robotic voice — which is why the first line sounded
  // different from every line after it. startVoice() is called from a
  // real click instead, so the whole conversation is af_bella.
  useEffect(() => {
    if (!active || !hotelId || hasStartedRef.current) return
    hasStartedRef.current = true
    setLog([{ from: 'alice', text: ALICE_ROOM_LINES.greeting.text }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hotelId])

  function startVoice() {
    const line = ALICE_ROOM_LINES.greeting
    speakThenListen(line.file, line.text, activeAudioRef, voiceEnabled, () => mic.start())
  }

  // Silences Alice completely — the audio element lives in this hook's ref,
  // so a caller cannot reach it any other way. Used when the guest opens a
  // room to read about it: she should not carry on asking about dates.
  function stopAll() {
    activeAudioRef.current?.pause()
    window.speechSynthesis?.cancel()
    mic.stop()
  }

  const today = new Date().toISOString().slice(0, 10)
  const allShownRooms = [...primaryRooms, ...secondaryRooms]

  function goTo(nextStep, lineKey) {
    mic.stop()
    setStep(nextStep)
    const line = ALICE_ROOM_LINES[lineKey]
    setLog((l) => [...l, { from: 'alice', text: line.text }])
    speakThenListen(line.file, line.text, activeAudioRef, voiceEnabled, () => mic.start())
  }

  function retry(lineKey, userHeard) {
    mic.stop()
    const line = ALICE_ROOM_LINES[lineKey]
    setLog((l) => [...l, ...(userHeard ? [{ from: 'user', text: userHeard }] : []), { from: 'alice', text: line.text }])
    speakThenListen(line.file, line.text, activeAudioRef, voiceEnabled, () => mic.start())
  }

  function submitPreferenceValue(value) {
    const text = (value ?? preference).trim()
    if (!text) return
    setPreference(text)
    setLog((l) => [...l, { from: 'user', text }])
    goTo('checkin', 'askCheckin')
  }

  function submitCheckInValue(value) {
    const v = value ?? checkIn
    if (!v) return
    setCheckIn(v)
    setLog((l) => [...l, { from: 'user', text: `Check-in: ${v}` }])
    goTo('checkout', 'askCheckout')
  }

  function submitCheckOutValue(value) {
    const v = value ?? checkOut
    if (!v) return
    setError('')
    if (v <= checkIn) { setError('Check-out must be after check-in.'); return }
    setCheckOut(v)
    setLog((l) => [...l, { from: 'user', text: `Check-out: ${v}` }])
    goTo('guests', 'askGuests')
  }

  async function submitGuestsValue(value) {
    const v = value ?? guests
    setGuests(v)
    setLog((l) => [...l, { from: 'user', text: `${v} guest${v === 1 ? '' : 's'}` }, { from: 'alice', text: ALICE_ROOM_LINES.checking.text }])
    mic.stop()
    setStep('searching')

    const checkingDonePromise = new Promise((resolve) => {
      speakThenListen(ALICE_ROOM_LINES.checking.file, ALICE_ROOM_LINES.checking.text, activeAudioRef, voiceEnabled, resolve)
    })

    await runSearch(v, checkingDonePromise)
  }

  function confirmThenAdvance(setter, value, submitFn) {
    setter(value)
    window.setTimeout(() => submitFn(value), 650)
  }

  function handleVoiceResult(transcript) {
    if (!transcript) return
    switch (stepRef.current) {
      case 'preference':
        if (!looksLikeRealPreference(transcript)) { retry('retryPreference', transcript); break }
        submitPreferenceValue(transcript)
        break
      case 'checkin': {
        const parsed = parseSpokenDate(transcript)
        if (parsed) confirmThenAdvance(setCheckIn, parsed, submitCheckInValue)
        else retry('retryCheckin', transcript)
        break
      }
      case 'checkout': {
        const parsed = parseSpokenDate(transcript)
        if (parsed) confirmThenAdvance(setCheckOut, parsed, submitCheckOutValue)
        else retry('retryCheckout', transcript)
        break
      }
      case 'guests': {
        const parsed = parseSpokenGuests(transcript)
        if (parsed) confirmThenAdvance(setGuests, parsed, submitGuestsValue)
        else retry('retryGuests', transcript)
        break
      }
      case 'results':
        submitConfirmValue(transcript)
        break
      default:
        break
    }
  }

  async function runSearch(guestCount, checkingDonePromise) {
    const message = `I'm looking for a room like this: ${preference}. My check-in date is ${checkIn} and check-out date is ${checkOut}, for ${guestCount} guest(s).`
    replyTextRef.current = ''
    setReplyText('')
    setStreaming(true)
    setPrimaryRooms([])
    setSecondaryRooms([])
    setNote('')
    setError('')

    await streamAssistant({
      message,
      onDelta: (text) => { replyTextRef.current += text; setReplyText(replyTextRef.current) },
      onDone: async (event) => {
        const finalText = replyTextRef.current
        setStreaming(false)
        setStep('results')
        setLog((l) => [...l, { from: 'alice', text: finalText }])
        setReplyText('')

        const rec = event.room_recommendations
        let shown = []
        if (rec) {
          setNote(rec.note || rec.based_on || '')
          if (Array.isArray(rec.matching_your_request)) {
            setPrimaryRooms(rec.matching_your_request); setSecondaryRooms([]); shown = rec.matching_your_request
          } else if (rec.matching_your_past_stays?.length) {
            setPrimaryRooms(rec.matching_your_past_stays); setSecondaryRooms(rec.other_available || [])
            shown = [...rec.matching_your_past_stays, ...(rec.other_available || [])]
          } else if (rec.available_rooms?.length) {
            setPrimaryRooms(rec.available_rooms); setSecondaryRooms([]); shown = rec.available_rooms
          } else {
            setPrimaryRooms(rec.other_available || []); setSecondaryRooms([]); shown = rec.other_available || []
          }
        }

        const prompt = shown.length === 0
          ? ''
          : shown.length === 1
            ? `Would you like me to book Room ${shown[0].room_number} for you? Just say "yes," or type it below.`
            : shown.length <= 3
              ? `Would you like Room ${shown.map((r) => r.room_number).join(' or Room ')}? Just tell me which one.`
              : `I've found several lovely options below. Just tell me the room number you'd like, or click "Book This Room" on your favorite.`

        await (checkingDonePromise || Promise.resolve())

        setPreparingVoice(true)
        narrateThenListen(finalText, activeAudioRef, voiceEnabled, () => {
          setPreparingVoice(false)
          if (prompt) {
            setLog((l) => [...l, { from: 'alice', text: prompt }])
            narrateThenListen(prompt, activeAudioRef, voiceEnabled, () => mic.start())
          } else {
            mic.start()
          }
        })
      },
      onError: (message) => {
        setStreaming(false)
        setStep('preference')
        setError(message)
      },
    })
  }

  function bookRoom(room) {
    activeAudioRef.current?.pause()
    window.speechSynthesis?.cancel()
    mic.stop()
    const params = new URLSearchParams({
      hotelId, roomId: room.room_id, roomNumber: room.room_number,
      roomTypeName: room.room_type || 'Hotel Room', price: String(room.base_price || 0),
      guests: String(guests), checkIn, checkOut,
    })
    const target = `/hotels/${hotelId}/booking/checkout?${params.toString()}`
    // The one point that genuinely needs an account. Signing in returns the
    // guest straight to this checkout, with the room and dates intact.
    if (!requireAuth(user, navigate, location, {
      from: target,
      reason: `Please sign in to complete your booking for Room ${room.room_number}. Your room and dates are saved.`,
    })) return
    navigate(target)
  }

  function submitConfirmValue(value) {
    const spoken = (value ?? confirmText).trim()
    if (!spoken) return
    setConfirmText('')
    mic.stop()

    const match = matchRoomFromText(spoken, allShownRooms)
    if (match) {
      const line = `Taking you to checkout for Room ${match.room_number}...`
      setLog((l) => [...l, { from: 'user', text: spoken }, { from: 'alice', text: line }])
      narrateThenListen(line, activeAudioRef, voiceEnabled, () => {})
      window.setTimeout(() => bookRoom(match), 800)
    } else {
      const line = "I couldn't quite tell which room you meant — say the room number, or type it below."
      setLog((l) => [...l, { from: 'user', text: spoken }, { from: 'alice', text: line }])
      narrateThenListen(line, activeAudioRef, voiceEnabled, () => mic.start())
    }
  }

  function startOver() {
    activeAudioRef.current?.pause()
    window.speechSynthesis?.cancel()
    mic.stop()
    setStep('preference')
    setPreference('')
    setPrimaryRooms([])
    setSecondaryRooms([])
    setNote('')
    setError('')
    setLog([{ from: 'alice', text: ALICE_ROOM_LINES.startOver.text }])
    speakThenListen(ALICE_ROOM_LINES.startOver.file, ALICE_ROOM_LINES.startOver.text, activeAudioRef, voiceEnabled, () => mic.start())
  }

  function toggleVoice() {
    if (voiceEnabled) { activeAudioRef.current?.pause(); window.speechSynthesis?.cancel() }
    setVoiceEnabled((v) => !v)
  }

  return {
    step, log, replyText, streaming, preparingVoice, error, primaryRooms, secondaryRooms, note, today,
    preference, setPreference, checkIn, setCheckIn, checkOut, setCheckOut, guests, setGuests,
    confirmText, setConfirmText,
    voiceEnabled, toggleVoice, mic,
    submitPreferenceValue, submitCheckInValue, submitCheckOutValue, submitGuestsValue, submitConfirmValue,
    startOver, bookRoom, startVoice, stopAll,
  }
}