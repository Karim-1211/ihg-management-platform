import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SEATED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-red-100 text-red-700',
}

const NEXT_ACTIONS = {
  CONFIRMED: [{ label: 'Seat', status: 'SEATED' }, { label: 'No-show', status: 'NO_SHOW' }],
  SEATED: [{ label: 'Complete', status: 'COMPLETED' }],
}

export default function StaffReservationsPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)

  const isScopedStaff = user?.role === 'WAITER'

  useEffect(() => {
    if (isScopedStaff) {
      setRestaurantId(user.restaurant_id || '')
      setLoading(false)
    } else {
      api.get('/restaurants').then((res) => {
        setRestaurants(res.data)
        if (res.data.length > 0) setRestaurantId(res.data[0].id)
        setLoading(false)
      })
    }
  }, [])

  useEffect(() => {
    if (!restaurantId) return
    loadReservations()
  }, [restaurantId])

  function loadReservations() {
    api.get(`/reservations/restaurant/${restaurantId}`).then((res) => setReservations(res.data))
  }

  async function handleAction(id, newStatus) {
    setActioningId(id)
    try {
      await api.patch(`/reservations/${id}/status`, { status: newStatus })
      loadReservations()
    } finally {
      setActioningId(null)
    }
  }

  if (isScopedStaff && !user.restaurant_id) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-navy mb-2">Not Assigned</h2>
          <p className="text-gray-500">Your account isn't assigned to a restaurant yet. Contact your manager.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Reservations</h1>
      <p className="text-gray-500 mb-6">Seat guests and manage table reservations</p>

      {!isScopedStaff && (
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="mb-6 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
        >
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && reservations.length === 0 && <p className="text-gray-500">No reservations yet.</p>}

      <div className="space-y-4">
        {reservations.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow-md p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-bold text-navy">Table {r.table_number} · Party of {r.party_size}</p>
              <p className="text-gray-500 text-sm">{new Date(r.reservation_start).toLocaleString()}</p>
              {r.notes && <p className="text-gray-400 text-xs">{r.notes}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status]}`}>
                {r.status}
              </span>
              {(NEXT_ACTIONS[r.status] || []).map((action) => (
                <button
                  key={action.status}
                  onClick={() => handleAction(r.id, action.status)}
                  disabled={actioningId === r.id}
                  className="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}