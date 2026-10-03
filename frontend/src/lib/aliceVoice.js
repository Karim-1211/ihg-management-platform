import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../services/api'

const POST_SPEECH_BUFFER_MS = 900

// Alice's recorded clips are in the voice her LOCAL engine uses. On a
// server that engine isn't installed, so live replies come from a hosted
// voice instead — and mixing the two means two different voices in one
// conversation. Setting VITE_ALICE_USE_CLIPS=false makes her speak every
// line through the hosted voice, so a guest hears one voice throughout.
const USE_CLIPS = import.meta.env.VITE_ALICE_USE_CLIPS !== 'false'

// 'hosted' until a hosted voice fails, then 'browser' for the rest of the
// page's life. Switching per line is what would produce two voices; this
// switches the whole conversation at once. A reload starts at 'hosted'
// again, so a refilled voice allowance is picked up by itself.
let voiceMode = 'hosted'

export function resetVoiceMode() {
  voiceMode = 'hosted'
}

// Resolves true when speech genuinely finished, false when it was cut off
// (cancelled or interrupted) — a cut-off utterance must never be treated as
// "Alice has finished", or the mic would open on top of whatever replaced it.
export function speakBrowserFallback(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis || !text?.trim()) { resolve(true); return }
    let settled = false
    const settle = (ok) => { if (!settled) { settled = true; resolve(ok) } }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
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

// Every new line claims the audioRef with a fresh token. Anything belonging
// to an older, superseded line checks the token before acting, so a stale
// line can never start the browser voice or open the mic.
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

function playAudio(audio, text, isCurrent, onReady, onFailed, label) {
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
  const failed = (reason) => {
    if (done) return
    done = true
    clearSafety()
    if (!isCurrent()) return
    console.warn(`[Alice] ${reason} for:`, label)
    onFailed()
  }

  audio.addEventListener('ended', complete)
  // A pause that isn't the natural end means the line was deliberately
  // stopped — by a newer line, a navigation, or the component unmounting.
  audio.addEventListener('pause', () => { if (!audio.ended) cancel() })
  audio.addEventListener('error', () => failed('Audio failed'))
  clearSafety = armSafetyTimer(audio, text, complete)

  audio.play().catch((err) => {
    // AbortError = play() was interrupted by pause(): an intentional stop,
    // NOT a playback failure.
    if (err?.name === 'AbortError' || !isCurrent()) { cancel(); return }
    failed('Playback blocked')
  })
}

async function speakWithBrowser(text, isCurrent, onReady) {
  const finishedNaturally = await speakBrowserFallback(text)
  if (finishedNaturally && isCurrent()) {
    window.setTimeout(() => { if (isCurrent()) onReady() }, POST_SPEECH_BUFFER_MS)
  }
}

// The single path every spoken line takes, so one conversation can never
// mix voices. `file` is an optional pre-recorded clip, used only when the
// clips match the voice this build speaks with.
async function speak(file, text, audioRef, voiceEnabled, onReady) {
  if (!voiceEnabled || !text?.trim()) { onReady(); return }
  audioRef.current?.pause()
  window.speechSynthesis?.cancel()
  // Claimed BEFORE any network wait, so a newer line spoken while this one
  // is still being fetched makes this one stand down instead of playing.
  const isCurrent = claim(audioRef)

  if (voiceMode === 'browser') {
    await speakWithBrowser(text, isCurrent, onReady)
    return
  }

  if (file && USE_CLIPS) {
    const audio = new Audio(file)
    audioRef.current = audio
    playAudio(audio, text, isCurrent, onReady, () => {
      voiceMode = 'browser'
      speakWithBrowser(text, isCurrent, onReady)
    }, file)
    return
  }

  try {
    const response = await api.post('/ai/room-narration', { text: text.slice(0, 1500) }, { responseType: 'blob' })
    if (!isCurrent()) return
    const url = URL.createObjectURL(response.data)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.addEventListener('ended', () => URL.revokeObjectURL(url))
    playAudio(audio, text, isCurrent, onReady, () => {
      voiceMode = 'browser'
      speakWithBrowser(text, isCurrent, onReady)
    }, 'live narration')
  } catch {
    // No hosted voice answered — the voice allowance may be spent, or the
    // provider unreachable. The REST of this conversation uses the browser
    // voice, rather than alternating between the two.
    if (!isCurrent()) return
    console.warn('[Alice] hosted voice unavailable — using the browser voice for this session.')
    voiceMode = 'browser'
    await speakWithBrowser(text, isCurrent, onReady)
  }
}

export function speakThenListen(file, text, audioRef, voiceEnabled, onReady) {
  speak(file, text, audioRef, voiceEnabled, onReady)
}

export function narrateThenListen(text, audioRef, voiceEnabled, onReady) {
  speak(null, text, audioRef, voiceEnabled, onReady)
}

// ---------- Listening ----------

const SILENCE_AFTER_SPEECH_MS = 1300
const NO_SPEECH_TIMEOUT_MS = 9000
const MAX_RECORDING_MS = 20000
const SPEECH_LEVEL = 0.014

const MIC_MESSAGES = {
  denied: "I can't use your microphone — please allow microphone access for this site, or type your answer below.",
  noDevice: "I can't find a microphone on this device — please type your answer below.",
  unsupported: "Voice input isn't supported in this browser — please type your answer below.",
  failed: "I'm having trouble hearing you right now — please type your answer below.",
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', '']
  for (const type of candidates) {
    if (!type) return ''
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return ''
}

// Records the guest's voice in the page and sends it to the backend to be
// transcribed, instead of using the browser's own voice typing. That
// depends on a speech service run by the browser's vendor, which stopped
// working in Chrome without warning and doesn't exist in some browsers.
// Here the same microphone behaves identically everywhere.
export function useAutoMic(onFinalResult) {
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState('')

  const supported = typeof window !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && typeof window.MediaRecorder !== 'undefined'

  const callbackRef = useRef(onFinalResult)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const contextRef = useRef(null)
  const frameRef = useRef(null)
  const timersRef = useRef([])
  const wantedRef = useRef(false)
  useEffect(() => { callbackRef.current = onFinalResult })

  const cleanup = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
    if (frameRef.current) { window.cancelAnimationFrame(frameRef.current); frameRef.current = null }
    try { recorderRef.current?.state === 'recording' && recorderRef.current.stop() } catch { /* already stopped */ }
    recorderRef.current = null
    try { contextRef.current?.close() } catch { /* already closed */ }
    contextRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const stop = useCallback(() => {
    wantedRef.current = false
    cleanup()
    setListening(false)
    setInterimText('')
  }, [cleanup])

  const start = useCallback(async () => {
    if (!supported) { setError(MIC_MESSAGES.unsupported); return }
    if (wantedRef.current) return
    wantedRef.current = true
    setError('')
    setInterimText('')
    setListening(true)

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (err) {
      wantedRef.current = false
      setListening(false)
      const name = err?.name || ''
      setError(name === 'NotAllowedError' || name === 'SecurityError'
        ? MIC_MESSAGES.denied
        : name === 'NotFoundError' ? MIC_MESSAGES.noDevice : MIC_MESSAGES.failed)
      return
    }

    if (!wantedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }
    streamRef.current = stream

    const mimeType = pickMimeType()
    let recorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch {
      stop()
      setError(MIC_MESSAGES.failed)
      return
    }
    recorderRef.current = recorder

    const chunks = []
    let heardSpeech = false
    let finished = false

    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }

    recorder.onstop = async () => {
      const wasWanted = wantedRef.current
      cleanup()
      setListening(false)
      setInterimText('')
      if (!wasWanted) return
      wantedRef.current = false

      // Nothing but silence: say nothing and leave the guest to type.
      if (!heardSpeech || !chunks.length) return

      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      if (blob.size < 1200) return

      try {
        setInterimText('…')
        const form = new FormData()
        form.append('audio', blob, mimeType.includes('mp4') ? 'speech.mp4' : 'speech.webm')
        const response = await api.post('/ai/transcribe', form)
        setInterimText('')
        const text = (response.data?.text || '').trim()
        if (text) callbackRef.current(text)
      } catch (err) {
        setInterimText('')
        setError(err.response?.data?.detail || MIC_MESSAGES.failed)
      }
    }

    // Stops as soon as the guest has finished speaking, so Alice replies
    // promptly instead of waiting out a fixed recording length.
    const finish = () => {
      if (finished) return
      finished = true
      try { recorder.state === 'recording' && recorder.stop() } catch { /* already stopped */ }
    }

    try {
      const context = new (window.AudioContext || window.webkitAudioContext)()
      contextRef.current = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      let quietSince = 0

      const tick = () => {
        if (finished || !wantedRef.current) return
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i]
        const level = Math.sqrt(sum / samples.length)

        if (level > SPEECH_LEVEL) {
          if (!heardSpeech) { heardSpeech = true; setInterimText('') }
          quietSince = 0
        } else if (heardSpeech) {
          if (!quietSince) quietSince = Date.now()
          else if (Date.now() - quietSince > SILENCE_AFTER_SPEECH_MS) { finish(); return }
        }
        frameRef.current = window.requestAnimationFrame(tick)
      }
      frameRef.current = window.requestAnimationFrame(tick)
    } catch {
      // No audio analysis available: fall back to a fixed recording length.
      heardSpeech = true
      timersRef.current.push(window.setTimeout(finish, 6000))
    }

    timersRef.current.push(window.setTimeout(() => { if (!heardSpeech) finish() }, NO_SPEECH_TIMEOUT_MS))
    timersRef.current.push(window.setTimeout(finish, MAX_RECORDING_MS))

    try {
      recorder.start()
    } catch {
      stop()
      setError(MIC_MESSAGES.failed)
    }
  }, [supported, cleanup, stop])

  useEffect(() => () => { wantedRef.current = false; cleanup() }, [cleanup])

  return { supported, listening, interimText, error, start, stop }
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

    // Previously this cleared the login and jumped the whole site to the
    // login page, losing the page and the conversation. A refusal is now
    // reported in the chat, so the guest decides what to do next.
    if (response.status === 401 || response.status === 403) {
      onError(token
        ? 'Your session has expired — please sign in again to carry on.'
        : "I'll need you to sign in before I can look that up for you.")
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