import { createContext, useContext, useState } from 'react'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your staff assistant. Ask me about pending work, orders, records, or your daily summary.",
}

const StaffAssistantContext = createContext(null)

export function StaffAssistantProvider({ children }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [open, setOpen] = useState(false)

  return (
    <StaffAssistantContext.Provider value={{ messages, setMessages, open, setOpen }}>
      {children}
    </StaffAssistantContext.Provider>
  )
}

export function useStaffAssistant() {
  const ctx = useContext(StaffAssistantContext)
  if (!ctx) throw new Error('useStaffAssistant must be used within a StaffAssistantProvider')
  return ctx
}