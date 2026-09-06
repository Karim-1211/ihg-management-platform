import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  AVAILABLE: 'bg-green-100 text-green-700',
  RESERVED: 'bg-yellow-100 text-yellow-700',
  OCCUPIED: 'bg-red-100 text-red-700',
  CLEANING: 'bg-gray-100 text-gray-700',
}

const STATUS_OPTIONS = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'CLEANING']

export default function StaffTablesPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')

  const isScopedStaff = user?.role === 'WAITER' || user?.role === 'KITCHEN'

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
    loadTables()
  }, [restaurantId])

  function loadTables() {
    api.get(`/restaurants/${restaurantId}/tables`).then((res) => setTables(res.data))
  }

  async function handleStatusChange(tableId, newStatus) {
    setError('')
    setUpdatingId(tableId)
    try {
      await api.patch(`/restaurant-tables/${tableId}/status`, { status: newStatus })
      loadTables()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update table.')
    } finally {
      setUpdatingId(null)
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
      <h1 className="text-2xl font-bold text-navy mb-2">Tables</h1>
      <p className="text-gray-500 mb-6">Manage table status</p>

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

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <div key={table.id} className="bg-white rounded-xl shadow-md p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-navy">Table {table.table_number}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[table.status]}`}>
                {table.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-3">Seats {table.capacity}</p>
            <select
              value={table.status}
              disabled={updatingId === table.id}
              onChange={(e) => handleStatusChange(table.id, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}