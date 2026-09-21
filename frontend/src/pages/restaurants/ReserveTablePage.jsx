import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function ReserveTablePage() {
  const { restaurantId } = useParams()
  // Prefilled when Alice hands off from the dining concierge, so the guest
  // doesn't re-enter what they already told her.
  const [searchParams] = useSearchParams()
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState(searchParams.get('tableId') || '')
  const [date, setDate] = useState(searchParams.get('date') || '')
  const [time, setTime] = useState(searchParams.get('time') || '')
  const [partySize, setPartySize] = useState(Number(searchParams.get('partySize')) || 2)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    api.get(`/restaurants/${restaurantId}/tables`).then((res) => setTables(res.data))
  }, [restaurantId])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setConfirmation(null)
    if (!tableId || !date || !time) {
      setError('Please fill in all fields.')
      return
    }
    setSubmitting(true)
    try {
      const reservation_start = `${date}T${time}:00`
      const res = await api.post('/reservations', {
        table_id: tableId,
        reservation_start,
        party_size: partySize,
        notes: notes || null,
      })
      setConfirmation(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create reservation.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-6">Reserve a Table</h1>

      <div className="max-w-md bg-white rounded-2xl shadow-md p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}
        {confirmation && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
            Reservation confirmed for Table {confirmation.table_number}, party of {confirmation.party_size}.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Table</label>
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="">Select a table...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>Table {t.table_number} ({t.capacity} seats)</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Party size</label>
            <input
              type="number" min="1" value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </div>
          <button
            type="submit" disabled={submitting}
            className="w-full py-2.5 bg-red text-white font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Booking...' : 'Reserve Table'}
          </button>
        </form>
      </div>
    </AppLayout>
  )
}