import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.65V5a2 2 0 1 0-4 0v.35A6 6 0 0 0 6 11v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
    </svg>
  )
}

const ENTITY_ROUTES = {
  booking: '/my-bookings',
  service_request: '/my-bookings',
  order: '/my-orders',
  delivery: '/my-deliveries',
  invoice: '/my-invoices',
  payment: '/my-invoices',
  stock_transaction: '/staff/inventory',
}

function timeAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationBell({ variant = 'light' }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const isDark = variant === 'dark'

  function loadUnreadCount() {
    api.get('/notifications/unread-count')
      .then((res) => setUnreadCount(res.data.unread_count))
      .catch(() => {})
  }

  function loadNotifications() {
    setLoading(true)
    api.get('/notifications')
      .then((res) => setNotifications(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 20000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) loadNotifications()
  }

  async function handleMarkRead(notification, e) {
    e.stopPropagation()
    try {
      await api.patch(`/notifications/${notification.id}/read`)
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, status: 'READ' } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silent — non-critical UI action
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, status: 'READ' })))
      setUnreadCount(0)
    } catch {
      // silent
    }
  }

  function handleNotificationClick(notification) {
    if (notification.status !== 'READ') {
      api.patch(`/notifications/${notification.id}/read`).catch(() => {})
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
    const route = ENTITY_ROUTES[notification.related_entity_type]
    setOpen(false)
    if (route) navigate(route)
  }

  const bellButtonClass = isDark
    ? 'relative p-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.07] transition-colors'
    : 'relative p-2.5 rounded-lg text-gray-600 hover:text-navy hover:bg-gray-50 transition-colors'

  const panelPositionClass = isDark
    ? 'absolute left-0 top-full mt-2'
    : 'absolute right-0 top-full mt-2'

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={toggleOpen} className={bellButtonClass} aria-label="Notifications">
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`${panelPositionClass} w-80 max-h-[28rem] overflow-y-auto rounded-xl border border-gray-100 bg-white py-2 shadow-2xl z-[200]`}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-bold text-navy">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-red hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {loading && <p className="px-4 py-6 text-sm text-gray-400 text-center">Loading...</p>}
          {!loading && notifications.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications yet.</p>
          )}

          {!loading && notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`
                mx-2 my-1 px-3 py-2.5 rounded-lg cursor-pointer transition-colors
                ${n.status !== 'READ' ? 'bg-red/5 hover:bg-red/10' : 'hover:bg-gray-50'}
              `}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm ${n.status !== 'READ' ? 'font-semibold text-navy' : 'font-medium text-gray-600'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
                {n.status !== 'READ' && (
                  <button
                    type="button"
                    onClick={(e) => handleMarkRead(n, e)}
                    className="shrink-0 w-2 h-2 rounded-full bg-red mt-1.5"
                    aria-label="Mark as read"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}