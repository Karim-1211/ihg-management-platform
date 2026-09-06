import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SEATED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-red-100 text-red-700',
}

export default function MyReservationsPage() {
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelingId, setCancelingId] = useState(null)

  function loadReservations() {
    setLoading(true)
    api.get('/reservations/my').then((res) => setReservations(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadReservations()
  }, [])

  async function handleCancel(id) {
    setCancelingId(id)
    try {
      await api.post(`/reservations/${id}/cancel`)
      loadReservations()
    } finally {
      setCancelingId(null)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-6">My Reservations</h1>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && reservations.length === 0 && <p className="text-gray-500">No reservations yet.</p>}

      <div className="space-y-4">
        {reservations.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow-md p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-bold text-navy">{r.restaurant_name} · Table {r.table_number}</p>
              <p className="text-gray-500 text-sm">
                {new Date(r.reservation_start).toLocaleString()} · Party of {r.party_size}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status]}`}>
                {r.status}
              </span>
              {r.status === 'CONFIRMED' && (
                <button
                  onClick={() => handleCancel(r.id)}
                  disabled={cancelingId === r.id}
                  className="px-3 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}