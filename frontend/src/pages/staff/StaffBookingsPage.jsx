import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import ConfirmDialog from '../../components/shared/ConfirmDialog'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

function ActionButtons({ booking, actioningId, onRequestAction }) {
  const canCancel = booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN'
  return (
    <div className="flex flex-wrap gap-2">
      {booking.status === 'CONFIRMED' && (
        <button
          onClick={() => onRequestAction(booking, 'check-in')}
          disabled={actioningId === booking.id}
          className="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
        >
          Check In
        </button>
      )}
      {booking.status === 'CHECKED_IN' && (
        <button
          onClick={() => onRequestAction(booking, 'check-out')}
          disabled={actioningId === booking.id}
          className="px-3 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
        >
          Check Out
        </button>
      )}
      {canCancel && (
        <button
          onClick={() => onRequestAction(booking, 'cancel')}
          disabled={actioningId === booking.id}
          className="px-3 py-1.5 border border-red text-red text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      )}
      {!canCancel && booking.status !== 'CONFIRMED' && booking.status !== 'CHECKED_IN' && (
        <span className="text-gray-400 text-xs">—</span>
      )}
    </div>
  )
}

const ACTION_CONFIG = {
  'check-in': {
    endpoint: 'check-in',
    title: 'Check in this guest?',
    message: (b) => `This will check in booking ${b.booking_reference} and mark the room as occupied.`,
    confirmLabel: 'Check In',
    destructive: false,
  },
  'check-out': {
    endpoint: 'check-out',
    title: 'Check out this guest?',
    message: (b) => `This will check out booking ${b.booking_reference}, generate the final invoice, and send the room to housekeeping.`,
    confirmLabel: 'Check Out',
    destructive: false,
  },
  'cancel': {
    endpoint: 'cancel',
    title: 'Cancel this booking?',
    message: (b) => `This will cancel booking ${b.booking_reference}. This cannot be undone, and is subject to the cancellation policy.`,
    confirmLabel: 'Cancel Booking',
    destructive: true,
  },
}

export default function StaffBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null) // { booking, actionKey }

  function loadBookings() {
    setLoading(true)
    api.get('/bookings')
      .then((res) => setBookings(res.data))
      .catch(() => setError('Could not load bookings.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadBookings()
  }, [])

  function handleRequestAction(booking, actionKey) {
    setPendingAction({ booking, actionKey })
  }

  async function handleConfirm() {
    if (!pendingAction) return
    const { booking, actionKey } = pendingAction
    const config = ACTION_CONFIG[actionKey]
    setError('')
    setActioningId(booking.id)
    setPendingAction(null)
    try {
      await api.post(`/bookings/${booking.id}/${config.endpoint}`)
      loadBookings()
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${actionKey}.`)
    } finally {
      setActioningId(null)
    }
  }

  const activeConfig = pendingAction ? ACTION_CONFIG[pendingAction.actionKey] : null

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">All Bookings</h1>
      <p className="text-gray-500 mb-6">Manage check-ins and check-outs</p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && bookings.length === 0 && <p className="text-gray-500">No bookings yet.</p>}

      {/* Mobile: stacked cards (below sm breakpoint) */}
      <div className="sm:hidden space-y-4">
        {bookings.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-navy">{b.booking_reference}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status] || 'bg-gray-100'}`}>
                {b.status}
              </span>
            </div>
            <p className="text-gray-600 text-sm">{b.check_in_date} → {b.check_out_date}</p>
            <p className="text-gray-600 text-sm mb-3">{b.number_of_guests} guest(s) · ${b.total_amount}</p>
            <ActionButtons booking={b} actioningId={actioningId} onRequestAction={handleRequestAction} />
          </div>
        ))}
      </div>

      {/* Desktop/tablet: table (sm breakpoint and above) */}
      <div className="hidden sm:block bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-5 py-3">Reference</th>
                <th className="text-left px-5 py-3">Dates</th>
                <th className="text-left px-5 py-3">Guests</th>
                <th className="text-left px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-5 py-4 font-medium text-navy">{b.booking_reference}</td>
                  <td className="px-5 py-4 text-gray-600 whitespace-nowrap">{b.check_in_date} → {b.check_out_date}</td>
                  <td className="px-5 py-4 text-gray-600">{b.number_of_guests}</td>
                  <td className="px-5 py-4 text-gray-600">${b.total_amount}</td>
                  <td className="px-5 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status] || 'bg-gray-100'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <ActionButtons booking={b} actioningId={actioningId} onRequestAction={handleRequestAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingAction}
        title={activeConfig?.title}
        message={pendingAction ? activeConfig.message(pendingAction.booking) : ''}
        confirmLabel={activeConfig?.confirmLabel}
        destructive={activeConfig?.destructive}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </AppLayout>
  )
}