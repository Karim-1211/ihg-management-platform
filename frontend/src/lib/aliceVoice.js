import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../services/api'

// Echo cancellation keeps Alice's own voice out of the recording, so the
// microphone can open almost as soon as she finishes.
const POST_SPEECH_BUFFER_MS = 450

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

// Speaks several pieces one after another, so the first can start playing
// while the later ones are still to be prepared. onReady runs once, after the
// last piece finishes naturally; if any piece is cut off, nothing after it
// ever speaks.
export function narrateChunks(chunks, audioRef, voiceEnabled, onReady) {
  const pieces = (chunks || []).filter((c) => c && c.trim())
  if (!pieces.length) { onReady(); return }
  const next = (i) => {
    speak(null, pieces[i], audioRef, voiceEnabled, () => {
      if (i + 1 < pieces.length) next(i + 1)
      else onReady()
    })
  }
  next(0)
}

// ---------- Listening ----------

const SILENCE_AFTER_SPEECH_MS = 900
const NO_SPEECH_TIMEOUT_MS = 8000
const MAX_RECORDING_MS = 25000
// Measured per recording rather than fixed: a fixed level was above some
// microphones' output entirely, so Alice never noticed the guest talking.
const SPEECH_FLOOR = 0.008
const SPEECH_OVER_NOISE = 2.5
// The threshold is never allowed above this, however loud the first moments
// were — a guest who starts talking straight away must not be mistaken for
// the room's background noise.
const SPEECH_CEILING = 0.03
const CALIBRATION_MS = 200
// A sample louder than this during calibration is a voice, not the room.
const VOICE_DURING_CALIBRATION = 0.04
// A recording must contain this much actual speech before it is sent.
// Whisper invents sentences when given silence, so anything shorter is
// discarded here rather than answered as if the guest had spoken.
const MIN_SPEECH_MS = 350
const MIN_BLOB_BYTES = 4000
// Two unusable recordings in a row means something is wrong — a muted
// microphone, a noisy room. Alice stops listening and asks the guest to
// type, instead of reopening the mic forever.
const MAX_EMPTY_IN_A_ROW = 2

const MIC_MESSAGES = {
  denied: "I can't use your microphone — please allow microphone access for this site, or type your answer below.",
  noDevice: "I can't find a microphone on this device — please type your answer below.",
  unsupported: "Voice input isn't supported in this browser — please type your answer below.",
  unheard: "I couldn't hear you clearly — please type your answer below, or tap the microphone to try again.",
  failed: "I'm having trouble hearing you right now — please type your answer below.",
}

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type
  }
  return ''
}

// Records the guest's voice in the page and sends it to the backend to be
// transcribed, instead of using the browser's own voice typing — that
// depends on a service run by the browser's vendor, which stopped working
// in Chrome without warning and doesn't exist in some browsers.
//
// `level` is the live microphone loudness, 0 to 1. Whisper transcribes a
// finished recording, so there are no partial words to show as the guest
// speaks; a moving sound bar tells them they are being heard instead.
export function useAutoMic(onFinalResult) {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [level, setLevel] = useState(0)
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
  const emptyRunRef = useRef(0)
  // Counts stop() calls, so a transcription that finishes AFTER Alice was
  // stopped can be recognised and ignored.
  const stopCountRef = useRef(0)
  useEffect(() => { callbackRef.current = onFinalResult })

  const cleanup = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
    if (frameRef.current) { window.cancelAnimationFrame(frameRef.current); frameRef.current = null }
    try { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() } catch { /* already stopped */ }
    recorderRef.current = null
    try { contextRef.current?.close() } catch { /* already closed */ }
    contextRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setLevel(0)
  }, [])

  const stop = useCallback(() => {
    stopCountRef.current += 1
    wantedRef.current = false
    cleanup()
    setListening(false)
    setTranscribing(false)
  }, [cleanup])

  const start = useCallback(async () => {
    if (!supported) { setError(MIC_MESSAGES.unsupported); return }
    if (wantedRef.current) return
    const generation = stopCountRef.current
    wantedRef.current = true
    setError('')

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
    let speechMs = 0
    let finished = false

    recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    // "Listening" is shown only once the recorder is genuinely capturing, so
    // the guest is never invited to speak before the first word can be kept.
    recorder.onstart = () => { if (wantedRef.current) setListening(true) }

    recorder.onstop = async () => {
      const wasWanted = wantedRef.current
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      const worthSending = wasWanted && blob.size >= MIN_BLOB_BYTES
      // Switched on BEFORE listening is switched off, so the guest sees
      // "Writing that down…" straight away with no blank moment between.
      if (worthSending) setTranscribing(true)
      cleanup()
      setListening(false)
      if (!wasWanted) return
      wantedRef.current = false

      // Not enough real speech to be worth sending. Saying nothing is far
      // better than answering a sentence Whisper invented from silence.
      console.log('[Alice] recording finished:', { speechMs: Math.round(speechMs), bytes: blob.size })
      if (blob.size < MIN_BLOB_BYTES) {
        emptyRunRef.current += 1
        if (emptyRunRef.current >= MAX_EMPTY_IN_A_ROW) setError(MIC_MESSAGES.unheard)
        return
      }

      try {
        const form = new FormData()
        form.append('audio', blob, mimeType.includes('mp4') ? 'speech.mp4' : 'speech.webm')
        const response = await api.post('/ai/transcribe', form)
        setTranscribing(false)
        const text = (response.data?.text || '').trim()
        if (!text) {
          emptyRunRef.current += 1
          if (emptyRunRef.current >= MAX_EMPTY_IN_A_ROW) setError(MIC_MESSAGES.unheard)
          return
        }
        emptyRunRef.current = 0
        if (generation !== stopCountRef.current) return
        callbackRef.current(text)
      } catch (err) {
        setTranscribing(false)
        setError(err.response?.data?.detail || MIC_MESSAGES.failed)
      }
    }

    // Stops as soon as the guest finishes speaking, so Alice replies
    // promptly rather than waiting out a fixed recording length.
    const finish = () => {
      if (finished) return
      finished = true
      try { if (recorder.state === 'recording') recorder.stop() } catch { /* already stopped */ }
    }

    try {
      const context = new (window.AudioContext || window.webkitAudioContext)()
      contextRef.current = context
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      context.createMediaStreamSource(stream).connect(analyser)
      const samples = new Float32Array(analyser.fftSize)
      let quietSince = 0
      let lastTick = performance.now()
      const startedAt = lastTick
      let noiseSum = 0
      let noiseCount = 0
      let threshold = SPEECH_FLOOR

      const tick = () => {
        if (finished || !wantedRef.current) return
        const now = performance.now()
        const elapsed = now - lastTick
        lastTick = now

        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i]
        const loudness = Math.sqrt(sum / samples.length)
        setLevel(Math.min(1, loudness * 18))

        // The opening moments are the room's own noise, not the guest.
        if (now - startedAt < CALIBRATION_MS) {
          if (loudness < VOICE_DURING_CALIBRATION) {
            noiseSum += loudness
            noiseCount += 1
            threshold = Math.min(SPEECH_CEILING, Math.max(SPEECH_FLOOR, (noiseSum / noiseCount) * SPEECH_OVER_NOISE))
          } else {
            // Already talking: count it as speech, not as background.
            speechMs += elapsed
          }
          frameRef.current = window.requestAnimationFrame(tick)
          return
        }

        if (loudness > threshold) {
          speechMs += elapsed
          quietSince = 0
        } else if (speechMs >= MIN_SPEECH_MS) {
          if (!quietSince) quietSince = now
          else if (now - quietSince > SILENCE_AFTER_SPEECH_MS) {
            console.log('[Alice] pause detected, sending.', { threshold: threshold.toFixed(4) })
            finish()
            return
          }
        }
        frameRef.current = window.requestAnimationFrame(tick)
      }
      frameRef.current = window.requestAnimationFrame(tick)
    } catch {
      // No audio analysis available: record a fixed stretch instead.
      speechMs = MIN_SPEECH_MS
      timersRef.current.push(window.setTimeout(finish, 6000))
    }

    // Only one deadline now. Deciding mid-recording that the guest "isn't
    // speaking" cut people off repeatedly, because the level that counts as
    // speech varies by microphone and room. The recording simply runs until
    // a clear pause, or this limit — and the server discards anything that
    // turns out to be silence.
    timersRef.current.push(window.setTimeout(finish, MAX_RECORDING_MS))

    try {
      recorder.start()
    } catch {
      stop()
      setError(MIC_MESSAGES.failed)
    }
  }, [supported, cleanup, stop])

  useEffect(() => () => { wantedRef.current = false; cleanup() }, [cleanup])

  // interimText is kept for the existing indicators; Whisper has no
  // partial results, so it reports the transcription stage instead.
  return {
    supported,
    listening,
    transcribing,
    level,
    interimText: transcribing ? 'Writing that down…' : '',
    error,
    start,
    stop,
  }
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