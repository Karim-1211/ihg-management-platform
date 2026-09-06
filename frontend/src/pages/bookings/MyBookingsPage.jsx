import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const SERVICE_TYPES = [
  { value: 'ROOM_CLEANING', label: 'Room Cleaning' },
  { value: 'EXTRA_TOWELS', label: 'Extra Towels' },
  { value: 'WATER', label: 'Water' },
  { value: 'FOOD', label: 'Food' },
  { value: 'AMENITIES', label: 'Amenities' },
  { value: 'OTHER', label: 'Other' },
]

function ServiceRequestForm({ bookingId, onSubmitted }) {
  const [requestType, setRequestType] = useState('ROOM_CLEANING')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.post('/service-requests', {
        booking_id: bookingId,
        request_type: requestType,
        description: description || null,
      })
      setDescription('')
      onSubmitted()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Request type</label>
        <select
          value={requestType} onChange={(e) => setRequestType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        >
          {SERVICE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
        <input
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Room 204, need 2 extra towels"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        />
      </div>
      <button
        type="submit" disabled={submitting}
        className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
      >
        {submitting ? 'Sending...' : 'Request'}
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </form>
  )
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRequests, setMyRequests] = useState([])
  const [openFormFor, setOpenFormFor] = useState(null)

  function loadData() {
    setLoading(true)
    Promise.all([api.get('/bookings/my'), api.get('/service-requests/my')])
      .then(([bookingsRes, requestsRes]) => {
        setBookings(bookingsRes.data)
        setMyRequests(requestsRes.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  function requestsForBooking(bookingId) {
    return myRequests.filter((r) => r.booking_id === bookingId)
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-6">My Bookings</h1>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && bookings.length === 0 && (
        <p className="text-gray-500">You don't have any bookings yet.</p>
      )}

      <div className="space-y-4">
        {bookings.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-bold text-navy">{b.booking_reference}</p>
                <p className="text-gray-500 text-sm">
                  {b.check_in_date} → {b.check_out_date} · {b.number_of_guests} guest(s)
                </p>
                <p className="text-gray-700 font-medium mt-1">${b.total_amount}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-700'}`}>
                  {b.status}
                </span>
                {b.status === 'CHECKED_IN' && (
                  <button
                    onClick={() => setOpenFormFor(openFormFor === b.id ? null : b.id)}
                    className="px-4 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-red-dark transition-colors"
                  >
                    Request Service
                  </button>
                )}
              </div>
            </div>

            {requestsForBooking(b.id).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                {requestsForBooking(b.id).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {SERVICE_TYPES.find((t) => t.value === r.request_type)?.label || r.request_type}
                      {r.description ? ` — ${r.description}` : ''}
                      {r.price ? ` (+$${r.price})` : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {openFormFor === b.id && (
              <ServiceRequestForm
                bookingId={b.id}
                onSubmitted={() => {
                  setOpenFormFor(null)
                  loadData()
                }}
              />
            )}
          </div>
        ))}
      </div>
    </AppLayout>
  )
}