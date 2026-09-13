import { createContext, useContext, useState } from 'react'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your guest assistant. Ask me about your bookings, orders, reservations, invoices, or hotel policies.",
}

const AssistantContext = createContext(null)

export function AssistantProvider({ children }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [open, setOpen] = useState(false)

  return (
    <AssistantContext.Provider value={{ messages, setMessages, open, setOpen }}>
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant() {
  const ctx = useContext(AssistantContext)
  if (!ctx) throw new Error('useAssistant must be used within an AssistantProvider')
  return ctx
}