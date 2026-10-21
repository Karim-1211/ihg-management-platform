import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requireAuth } from './authRedirect'
import { useAutoMic, speakThenListen, narrateThenListen, narrateChunks, streamAssistant } from './aliceVoice'
import {
  SMALL_TALK_LINES, classifyPreference, parseSpokenDate, parseSpokenGuests,
  matchRoomFromText, describeResults, splitForSpeech,
} from './aliceParsing'

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

export const ALICE_SIGN_IN_LINE = "To check live availability for your dates, I'll just need you to sign in — it only takes a moment, and I'll bring you straight back here."

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
  const unclearCountRef = useRef(0)
  const retryRunRef = useRef(0)
  const lastMicErrorRef = useRef('')

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

  // When the microphone gives up, Alice says so in the conversation, so
  // the guest knows to type rather than waiting on a mic that can't hear.
  // Shown, not spoken: speaking it would reopen the very mic that failed.
  useEffect(() => {
    if (!mic.error) { lastMicErrorRef.current = ''; return }
    if (mic.error === lastMicErrorRef.current) return
    lastMicErrorRef.current = mic.error
    setLog((l) => [...l, { from: 'alice', text: mic.error }])
  }, [mic.error])

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
    retryRunRef.current = 0
    setStep(nextStep)
    const line = ALICE_ROOM_LINES[lineKey]
    setLog((l) => [...l, { from: 'alice', text: line.text }])
    speakThenListen(line.file, line.text, activeAudioRef, voiceEnabled, () => mic.start())
  }

  function retry(lineKey, userHeard) {
    mic.stop()
    // The microphone reopens after an unclear answer at most twice in a
    // row; after that Alice hands over to the keyboard instead of looping.
    retryRunRef.current += 1
    const giveUp = retryRunRef.current > 2
    const line = ALICE_ROOM_LINES[lineKey]
    const handOver = "I'm having trouble catching that — please type your answer below, or tap the microphone to try again."
    setLog((l) => [...l, ...(userHeard ? [{ from: 'user', text: userHeard }] : []), { from: 'alice', text: giveUp ? handOver : line.text }])
    if (giveUp) {
      retryRunRef.current = 0
      narrateThenListen(handOver, activeAudioRef, voiceEnabled, () => {})
      return
    }
    speakThenListen(line.file, line.text, activeAudioRef, voiceEnabled, () => mic.start())
  }

  // A reply with no pre-recorded clip: narrated live, then listening again.
  function sayLine(text, userText) {
    mic.stop()
    setLog((l) => [...l, ...(userText ? [{ from: 'user', text: userText }] : []), { from: 'alice', text }])
    narrateThenListen(text, activeAudioRef, voiceEnabled, () => mic.start())
  }

  // The single entry point for the first step, typed or spoken. Previously
  // a typed answer skipped every check, so "hi" became the guest's room
  // preference and Alice moved straight on to dates.
  function handlePreference(raw) {
    const text = (raw ?? preference).trim()
    if (!text) return

    const kind = classifyPreference(text)

    if (kind === 'room') {
      unclearCountRef.current = 0
      setPreference(text)
      setLog((l) => [...l, { from: 'user', text }])
      goTo('checkin', 'askCheckin')
      return
    }

    // Anything else keeps the guest on this step, with the box cleared.
    setPreference('')

    if (kind === 'unclear') {
      unclearCountRef.current += 1
      // Twice in a row: don't trap the guest in a loop. Show them
      // everything that's free instead.
      if (unclearCountRef.current >= 2) {
        unclearCountRef.current = 0
        setPreference('any available room')
        setStep('checkin')
        sayLine(SMALL_TALK_LINES.moveOn, text)
        return
      }
      retry('retryPreference', text)
      return
    }

    unclearCountRef.current = 0
    sayLine(SMALL_TALK_LINES[kind], text)
  }

  function submitPreferenceValue(value) {
    handlePreference(value)
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

    // Room search is open to everyone: a visitor can see real availability
    // before creating an account. Signing in is needed only at booking.
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
    window.setTimeout(() => submitFn(value), 300)
  }

  function handleVoiceResult(transcript) {
    if (!transcript) return
    switch (stepRef.current) {
      case 'preference':
        handlePreference(transcript)
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
        const aiText = replyTextRef.current
        setStreaming(false)
        setStep('results')
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

        // With rooms in hand, Alice's summary is built from the rooms
        // themselves: instant, short to say, and always in step with the
        // cards on screen. Her free-form wording is used only when there is
        // nothing to list.
        const spokenText = shown.length ? describeResults(shown).text : (aiText || describeResults([]).text)
        setLog((l) => [...l, { from: 'alice', text: spokenText }])

        // The "checking" line is only waited for briefly. Results that are
        // ready should be heard now, not after a pleasantry has finished.
        await Promise.race([
          checkingDonePromise || Promise.resolve(),
          new Promise((resolve) => window.setTimeout(resolve, 1200)),
        ])

        setPreparingVoice(true)
        narrateChunks(splitForSpeech(spokenText), activeAudioRef, voiceEnabled, () => {
          setPreparingVoice(false)
          mic.start()
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
      unclearCountRef.current = 0
      const line = `Taking you to checkout for Room ${match.room_number}.`
      setLog((l) => [...l, { from: 'user', text: spoken }, { from: 'alice', text: line }])
      // Navigate only when she has FINISHED the sentence. With the voice
      // off, the callback runs at once. If the guest interrupts, it never
      // runs, so a cancelled sentence cannot still move the page.
      narrateThenListen(line, activeAudioRef, voiceEnabled, () => bookRoom(match))
    } else {
      // After two misses, stop reopening the microphone. Repeating the
      // same question forever is worse than inviting the guest to type.
      unclearCountRef.current += 1
      const giveUp = unclearCountRef.current >= 2
      const numbers = allShownRooms.slice(0, 4).map((r) => r.room_number).join(', ')
      const line = giveUp
        ? `I heard "${spoken}", which doesn't match a room I found — please type the number below, or tap "Book This Room" on the one you like.`
        : `I heard "${spoken}", but I couldn't match it to a room. The rooms I found are ${numbers}. Which one would you like?`
      setLog((l) => [...l, { from: 'user', text: spoken }, { from: 'alice', text: line }])
      narrateThenListen(line, activeAudioRef, voiceEnabled, () => { if (!giveUp) mic.start() })
    }
  }

  function startOver() {
    activeAudioRef.current?.pause()
    window.speechSynthesis?.cancel()
    mic.stop()
    unclearCountRef.current = 0
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