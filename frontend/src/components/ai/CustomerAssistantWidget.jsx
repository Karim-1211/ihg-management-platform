import { useEffect, useRef, useState } from 'react'
import api from '../../services/api'
import { useAssistant } from '../../context/AssistantContext'

function ChatIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.17 0-2.29-.2-3.31-.57L3 21l1.67-3.76C3.62 15.99 3 14.06 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
    </svg>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
    </div>
  )
}

export default function CustomerAssistantWidget() {
  const { messages, setMessages, open, setOpen } = useAssistant()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, open])

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setError('')
    setLoading(true)

    try {
      const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }))
      const res = await api.post('/ai/customer-assistant', {
        message: trimmed,
        conversation_history: history,
      })
      setMessages([...newMessages, { role: 'assistant', content: res.data.reply }])
    } catch (err) {
      setError('The assistant is temporarily unavailable. Please try again shortly.')
      setMessages(newMessages)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-6 right-6 z-[150] flex h-14 w-14 items-center justify-center rounded-full bg-[#1F3A5F] text-white shadow-[0_8px_24px_rgba(31,58,95,0.4)] transition-transform hover:scale-105"
        >
          <ChatIcon />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-[150] flex h-[560px] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_60px_-10px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between bg-gradient-to-r from-[#1F3A5F] to-[#132840] px-5 py-4">
            <div>
              <p className="text-[13px] font-bold text-white">Guest Assistant</p>
              <p className="text-[11px] text-white/50">Here to help with your stay</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              <CloseIcon />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#1F3A5F] text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <TypingIndicator />
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
                {error}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your booking, order..."
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF2147] text-white transition-colors hover:bg-[#e01d3f] disabled:opacity-40"
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </>
  )
}