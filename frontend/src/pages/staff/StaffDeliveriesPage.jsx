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
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [deliveries, setDeliveries] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedDriver, setSelectedDriver] = useState({})
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)
  const [error, setError] = useState('')

  // Super admins and managers aren't tied to one restaurant, so they pick
  // which one to work on — the same pattern every other staff page uses.
  // Previously this page read user.restaurant_id unconditionally, which is
  // why a super admin saw "Not Assigned" here.
  const isScopedStaff = user?.role === 'WAITER'

  useEffect(() => {
    if (isScopedStaff) {
      setRestaurantId(user.restaurant_id || '')
      setLoading(false)
    } else {
      api.get('/restaurants')
        .then((res) => {
          setRestaurants(res.data)
          if (res.data.length > 0) setRestaurantId(res.data[0].id)
        })
        .catch(() => setError('Could not load the restaurant list.'))
        .finally(() => setLoading(false))
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restaurantId) return
    loadDeliveries()
    api.get(`/restaurants/${restaurantId}/drivers`)
      .then((res) => setDrivers(res.data))
      .catch(() => setDrivers([]))
  }, [restaurantId])

  function loadDeliveries() {
    api.get(`/deliveries/restaurant/${restaurantId}`)
      .then((res) => setDeliveries(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load deliveries.'))
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

  if (isScopedStaff && !user.restaurant_id) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <h2 className="mb-2 text-xl font-bold text-[#1F3A5F]">Not assigned</h2>
          <p className="text-slate-500">Your account isn't assigned to a restaurant yet. Contact your manager.</p>
        </div>
      </AppLayout>
    )
  }

  const pending = deliveries.filter((d) => d.status === 'PENDING').length

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">Deliveries</h1>
          <p className="mt-1 text-slate-500">Assign drivers to delivery orders</p>
        </div>
        {pending > 0 && (
          <span className="rounded-full bg-[#FF2147]/10 px-4 py-2 text-sm font-bold text-[#FF2147]">
            {pending} waiting for a driver
          </span>
        )}
      </div>

      {!isScopedStaff && (
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="mb-6 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]"
        >
          {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && deliveries.length === 0 && <p className="text-slate-500">No deliveries yet.</p>}
      {!loading && deliveries.length > 0 && drivers.length === 0 && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No delivery drivers are assigned to this restaurant yet, so orders can't be dispatched.
        </p>
      )}

      <div className="space-y-3">
        {deliveries.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <div className="min-w-[200px]">
              <p className="font-bold text-[#1F3A5F]">{d.order_number}</p>
              <p className="text-sm text-slate-500">{d.delivery_address}</p>
              {d.driver_name && <p className="mt-0.5 text-xs text-slate-400">Driver: {d.driver_name}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[d.status]}`}>
                {d.status.replace(/_/g, ' ')}
              </span>
              {d.status === 'PENDING' && (
                <>
                  <select
                    value={selectedDriver[d.id] || ''}
                    onChange={(e) => setSelectedDriver((prev) => ({ ...prev, [d.id]: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-[#1F3A5F]"
                  >
                    <option value="">Select driver…</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.first_name} {driver.last_name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(d.id)}
                    disabled={assigningId === d.id}
                    className="rounded-lg bg-[#1F3A5F] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#162f4d] disabled:opacity-50"
                  >
                    {assigningId === d.id ? 'Assigning…' : 'Assign'}
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