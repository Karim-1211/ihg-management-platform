import { useEffect, useRef, useState } from 'react'
import api from '../services/api'

const POST_SPEECH_BUFFER_MS = 900

// Resolves true when speech genuinely finished, false when it was cut off
// (cancelled or interrupted) — a cut-off utterance must never be treated as
// "Alice has finished", or the mic would open on top of whatever replaced it.
export function speakBrowserFallback(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || !text?.trim()) { resolve(true); return }
    let settled = false
    const settle = (ok) => { if (!settled) { settled = true; resolve(ok) } }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.9
    utterance.pitch = 1.0
    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => /female|zira|jenny|aria|samantha|susan|karen|moira|tessa/i.test(v.name)) ||
      voices.find((v) => v.lang?.startsWith('en'))
    if (preferred) utterance.voice = preferred
    utterance.onend = () => settle(true)
    utterance.onerror = (e) => settle(!(e?.error === 'canceled' || e?.error === 'interrupted'))
    window.speechSynthesis.speak(utterance)
    window.setTimeout(() => settle(true), Math.max(20000, text.length * 110))
  })
}

// Every new clip claims the audioRef with a fresh token. Anything belonging
// to an older, superseded clip checks the token before acting, so a stale
// clip can never start the browser voice or open the mic.
function claim(audioRef) {
  const token = {}
  audioRef.speechToken = token
  return () => audioRef.speechToken === token
}

// Safety net sized from the clip's REAL remaining duration once playback
// starts — never a fixed short timer that could fire mid-sentence.
function armSafetyTimer(audio, text, onTimeout) {
  let timer = window.setTimeout(onTimeout, Math.max(30000, (text?.length || 0) * 120))
  audio.addEventListener('playing', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      window.clearTimeout(timer)
      const remainingMs = (audio.duration - (audio.currentTime || 0)) * 1000
      timer = window.setTimeout(onTimeout, remainingMs + 4000)
    }
  })
  return () => window.clearTimeout(timer)
}

// Wires one <audio> element to the three possible outcomes:
//   finished naturally   -> onReady (after a short buffer)
//   stopped / superseded -> nothing at all
//   genuinely blocked    -> browser voice, then onReady
function playClip(audio, text, isCurrent, onReady, label) {
  let done = false
  let clearSafety = () => {}

  const readyAfterBuffer = () => {
    window.setTimeout(() => { if (isCurrent()) onReady() }, POST_SPEECH_BUFFER_MS)
  }
  const complete = () => {
    if (done) return
    done = true
    clearSafety()
    if (isCurrent()) readyAfterBuffer()
  }
  const cancel = () => {
    if (done) return
    done = true
    clearSafety()
  }
  const fallback = async (reason) => {
    if (done) return
    done = true
    clearSafety()
    if (!isCurrent()) return
    console.warn(`[Alice] ${reason}, using browser voice for:`, label)
    const finishedNaturally = await speakBrowserFallback(text)
    if (finishedNaturally && isCurrent()) readyAfterBuffer()
  }

  audio.addEventListener('ended', complete)
  // A pause that isn't the natural end means the clip was deliberately
  // stopped — by a newer line, a navigation, or the component unmounting.
  audio.addEventListener('pause', () => { if (!audio.ended) cancel() })
  audio.addEventListener('error', () => fallback('Audio failed'))
  clearSafety = armSafetyTimer(audio, text, complete)

  audio.play().catch((err) => {
    // AbortError = play() was interrupted by pause(): an intentional stop,
    // NOT an autoplay block. Treating it as a block is what produced the
    // second (robotic) voice and the early mic.
    if (err?.name === 'AbortError' || !isCurrent()) { cancel(); return }
    fallback('Autoplay blocked')
  })
}

export function speakThenListen(file, text, audioRef, voiceEnabled, onReady) {
  if (!voiceEnabled) { onReady(); return }
  audioRef.current?.pause()
  window.speechSynthesis?.cancel()
  const isCurrent = claim(audioRef)
  const audio = new Audio(file)
  audioRef.current = audio
  playClip(audio, text, isCurrent, onReady, file)
}

export async function narrateThenListen(text, audioRef, voiceEnabled, onReady) {
  if (!voiceEnabled || !text?.trim()) { onReady(); return }
  audioRef.current?.pause()
  window.speechSynthesis?.cancel()
  // Claimed BEFORE the network wait, so a newer line spoken while this one
  // is still being generated makes this one stand down instead of playing.
  const isCurrent = claim(audioRef)
  try {
    const response = await api.post('/ai/room-narration', { text: text.slice(0, 1500) }, { responseType: 'blob' })
    if (!isCurrent()) return
    const url = URL.createObjectURL(response.data)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.addEventListener('ended', () => URL.revokeObjectURL(url))
    playClip(audio, text, isCurrent, onReady, 'live narration')
  } catch {
    if (!isCurrent()) return
    const finishedNaturally = await speakBrowserFallback(text)
    if (finishedNaturally && isCurrent()) {
      window.setTimeout(() => { if (isCurrent()) onReady() }, POST_SPEECH_BUFFER_MS)
    }
  }
}

// One shared recognition instance. Keeps itself listening across the
// browser's own silence timeout, and discards anything reported "final"
// within 400ms of starting (leftover echo of Alice's own voice).
export function useAutoMic(onFinalResult) {
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  const recognitionRef = useRef(null)
  const callbackRef = useRef(onFinalResult)
  const keepAliveRef = useRef(false)
  const gotResultRef = useRef(false)
  const restartScheduledRef = useRef(false)
  useEffect(() => { callbackRef.current = onFinalResult })

  function scheduleRestart() {
    if (restartScheduledRef.current) return
    restartScheduledRef.current = true
    window.setTimeout(() => {
      restartScheduledRef.current = false
      if (keepAliveRef.current) startInternal()
    }, 350)
  }

  function startInternal() {
    if (!supported || recognitionRef.current) return
    const Impl = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new Impl()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1
    gotResultRef.current = false
    setInterimText('')
    const startedAt = Date.now()

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const transcript = last[0].transcript
      if (last.isFinal) {
        if (Date.now() - startedAt < 400) return
        gotResultRef.current = true
        setInterimText('')
        console.log('[Alice] heard:', JSON.stringify(transcript))
        callbackRef.current(transcript.trim())
      } else {
        setInterimText(transcript)
      }
    }
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
      setInterimText('')
      if (keepAliveRef.current && !gotResultRef.current) scheduleRestart()
    }
    recognition.onerror = (e) => {
      recognitionRef.current = null
      setListening(false)
      setInterimText('')
      if (keepAliveRef.current && e.error !== 'aborted' && e.error !== 'not-allowed') scheduleRestart()
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
    }
  }

  function start() {
    keepAliveRef.current = true
    startInternal()
  }

  function stop() {
    keepAliveRef.current = false
    recognitionRef.current?.stop()
  }

  return { supported, listening, interimText, start, stop }
}

export async function streamAssistant({ message, conversationHistory = [], onDelta, onDone, onError }) {
  try {
    const token = localStorage.getItem('ihg_token')
    const baseURL = api.defaults.baseURL || ''
    const response = await fetch(`${baseURL}/ai/customer-assistant/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message, conversation_history: conversationHistory }),
    })

    if (response.status === 401) {
      localStorage.removeItem('ihg_token')
      if (window.location.pathname !== '/login') window.location.href = '/login'
      return
    }
    if (!response.ok || !response.body) throw new Error('Stream request failed')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const line = rawEvent.replace(/^data:\s*/, '')
        if (!line) continue
        const event = JSON.parse(line)
        if (event.type === 'text') onDelta(event.text)
        else if (event.type === 'done') onDone(event)
        else if (event.type === 'error') onError(event.message)
      }
    }
  } catch (err) {
    onError(err.message || 'Alice is unavailable right now.')
  }
}