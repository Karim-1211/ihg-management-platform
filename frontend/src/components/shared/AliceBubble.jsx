import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useAutoMic, speakThenListen, narrateThenListen, streamAssistant } from '../../lib/aliceVoice'

const GREETING_FILE = '/audio/alice-greeting.wav'
const GREETING_TEXT = "Hello, I'm Alice, your personal hotel concierge. I'm here to help you find the room you'll love. Tell me what you're looking for — a view, a balcony, a quiet floor, anything that matters to you."

export default function AliceBubble() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const audioRef = useRef(null)
  const historyRef = useRef([])
  const replyTextRef = useRef('')
  const logEndRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('menu')
  const [greeted, setGreeted] = useState(false)
  const [log, setLog] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [replyText, setReplyText] = useState('')

  const mic = useAutoMic((t) => t && submitQuestion(t))
  const isCustomer = user?.role === 'CUSTOMER'
  const onHotelRoomPage = /^\/hotels\/[^/]+$/.test(location.pathname)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log, replyText])

  useEffect(() => () => { mic.stop(); audioRef.current?.pause(); window.speechSynthesis?.cancel() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function openBubble() {
    setOpen(true)
    setMode('menu')
    if (!greeted) {
      setGreeted(true)
      setLog([{ from: 'alice', text: GREETING_TEXT }])
      speakThenListen(GREETING_FILE, GREETING_TEXT, audioRef, true, () => {})
    }
  }

  function closeBubble() {
    setOpen(false)
    mic.stop()
    audioRef.current?.pause()
    window.speechSynthesis?.cancel()
  }

  function startFindRoom() {
    if (onHotelRoomPage) {
      closeBubble()
      window.setTimeout(() => {
        document.getElementById('ai-concierge-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else {
      closeBubble()
      navigate('/hotels')
    }
  }

  function startAskQuestion() {
    setMode('chat')
    setLog((l) => [...l, { from: 'alice', text: "Sure — go ahead, I'm listening. You can also just type below." }])
    mic.start()
  }

  async function submitQuestion(value) {
    const question = (value ?? input).trim()
    if (!question) return
    setInput('')
    mic.stop()
    setLog((l) => [...l, { from: 'user', text: question }])
    historyRef.current = [...historyRef.current, { role: 'user', content: question }].slice(-10)
    replyTextRef.current = ''
    setReplyText('')
    setStreaming(true)

    await streamAssistant({
      message: question,
      conversationHistory: historyRef.current,
      onDelta: (t) => { replyTextRef.current += t; setReplyText(replyTextRef.current) },
      onDone: () => {
        const finalText = replyTextRef.current
        setStreaming(false)
        setReplyText('')
        setLog((l) => [...l, { from: 'alice', text: finalText }])
        historyRef.current = [...historyRef.current, { role: 'assistant', content: finalText }].slice(-10)
        narrateThenListen(finalText, audioRef, true, () => mic.start())
      },
      onError: (message) => {
        setStreaming(false)
        setLog((l) => [...l, { from: 'alice', text: message }])
      },
    })
  }

  if (!isCustomer) return null

  return (
    <>
      <style>{`
        @keyframes alicePulseRing {
          0% { box-shadow: 0 0 0 0 rgba(255,33,71,0.45); }
          70% { box-shadow: 0 0 0 14px rgba(255,33,71,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,33,71,0); }
        }
        .alice-fab { animation: alicePulseRing 2.8s ease-out infinite; }
      `}</style>

      {!open && (
        <button
          type="button"
          onClick={openBubble}
          aria-label="Chat with Alice"
          title="Chat with Alice, your AI concierge"
          className="alice-fab fixed bottom-6 right-24 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF2147] text-white shadow-lg transition hover:bg-[#dc1539] sm:right-28"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[92vw] max-w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between bg-[#1F3A5F] px-5 py-4 text-white">
            <div>
              <p className="text-sm font-bold">Alice</p>
              <p className="text-xs text-white/70">AI Concierge</p>
            </div>
            <button type="button" onClick={closeBubble} aria-label="Close" className="rounded-full p-1.5 hover:bg-white/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {log.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'alice' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-6 ${m.from === 'alice' ? 'bg-white text-slate-700 ring-1 ring-slate-200' : 'bg-[#1F3A5F] text-white'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-white px-3.5 py-2 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
                  {replyText}<span className="animate-pulse">▌</span>
                </div>
              </div>
            )}
            {mode === 'menu' && (
              <div className="flex flex-col gap-2 pt-1">
                <button type="button" onClick={startFindRoom} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#1F3A5F] hover:bg-slate-50">🛏️ Find me a room</button>
                <button type="button" onClick={startAskQuestion} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-[#1F3A5F] hover:bg-slate-50">💬 Ask a question</button>
              </div>
            )}
            <div ref={logEndRef} />
          </div>

          {mode === 'chat' && (
            <form onSubmit={(e) => { e.preventDefault(); submitQuestion() }} className="border-t border-slate-200 p-3">
              {mic.listening && <p className="mb-2 text-center text-xs font-semibold text-[#FF2147]">🎙 Listening… {mic.interimText ? `"${mic.interimText}"` : ''}</p>}
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your booking, orders, policies…"
                  className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#1F3A5F]"
                />
                <button type="submit" disabled={!input.trim()} className="rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Send</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  )
}