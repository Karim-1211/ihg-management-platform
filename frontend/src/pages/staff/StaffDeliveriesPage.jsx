import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function StaffDeliveriesPage() {
  const { user } = useAuth()
  const [restaurantId, setRestaurantId] = useState('')
  const [deliveries, setDeliveries] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedDriver, setSelectedDriver] = useState({})
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setRestaurantId(user?.restaurant_id || '')
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!restaurantId) return
    loadDeliveries()
    api.get(`/restaurants/${restaurantId}/drivers`).then((res) => setDrivers(res.data))
  }, [restaurantId])

  function loadDeliveries() {
    api.get(`/deliveries/restaurant/${restaurantId}`).then((res) => setDeliveries(res.data))
  }

  async function handleAssign(deliveryId) {
    const driverId = selectedDriver[deliveryId]
    if (!driverId) {
      setError('Please select a driver first.')
      return
    }
    setError('')
    setAssigningId(deliveryId)
    try {
      await api.patch(`/deliveries/${deliveryId}/assign`, { driver_id: driverId })
      loadDeliveries()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not assign driver.')
    } finally {
      setAssigningId(null)
    }
  }

  if (!user?.restaurant_id) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-navy mb-2">Not Assigned</h2>
          <p className="text-gray-500">Your account isn't assigned to a restaurant yet.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Deliveries</h1>
      <p className="text-gray-500 mb-6">Assign drivers to delivery orders</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && deliveries.length === 0 && <p className="text-gray-500">No deliveries yet.</p>}
      {!loading && drivers.length === 0 && (
        <p className="text-yellow-600 text-sm mb-4">No delivery drivers are assigned to this restaurant yet.</p>
      )}

      <div className="space-y-4">
        {deliveries.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl shadow-md p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-bold text-navy">{d.order_number}</p>
              <p className="text-gray-500 text-sm">{d.delivery_address}</p>
              {d.driver_name && <p className="text-gray-400 text-xs">Driver: {d.driver_name}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[d.status]}`}>
                {d.status.replace(/_/g, ' ')}
              </span>
              {d.status === 'PENDING' && (
                <>
                  <select
                    value={selectedDriver[d.id] || ''}
                    onChange={(e) => setSelectedDriver((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-navy"
                  >
                    <option value="">Select driver...</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.first_name} {driver.last_name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(d.id)}
                    disabled={assigningId === d.id}
                    className="px-3 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
                  >
                    Assign
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}