import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your staff assistant. Ask me about pending work, orders, records, or your daily summary.",
}

const StaffAssistantContext = createContext(null)

export function StaffAssistantProvider({ children }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [open, setOpen] = useState(false)
  const lastUserIdRef = useRef(user?.id ?? null)

  // Security fix: reset the conversation whenever the logged-in user
  // changes (including to null on logout), so one staff account's
  // conversation can never be seen by a different account afterward.
  useEffect(() => {
    const currentUserId = user?.id ?? null
    if (currentUserId !== lastUserIdRef.current) {
      lastUserIdRef.current = currentUserId
      setMessages([WELCOME_MESSAGE])
      setOpen(false)
    }
  }, [user?.id])

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