import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  NEW: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-indigo-100 text-indigo-700',
  READY: 'bg-purple-100 text-purple-700',
  SERVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function StaffOrdersPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)
  const [error, setError] = useState('')

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
    loadOrders()
  }, [restaurantId])

  function loadOrders() {
    api.get(`/orders/restaurant/${restaurantId}`).then((res) => setOrders(res.data))
  }

  async function handleAction(orderId, action) {
    setError('')
    setActioningId(orderId)
    try {
      if (action === 'cancel') {
        await api.patch(`/orders/${orderId}/status`, { status: 'CANCELLED' })
      } else {
        await api.patch(`/orders/${orderId}/status`, { status: action })
      }
      loadOrders()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update order.')
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
      <h1 className="text-2xl font-bold text-navy mb-2">Orders</h1>
      <p className="text-gray-500 mb-6">Confirm new orders and serve completed ones</p>

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
      {!loading && orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <p className="font-bold text-navy">{order.order_number}</p>
                <p className="text-gray-500 text-sm">
                  Table {order.table_number || '-'} · {order.items.length} item(s) · ${order.total_amount}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status]}`}>
                {order.status}
              </span>
            </div>

            <div className="flex gap-2 flex-wrap">
              {order.status === 'NEW' && (
                <>
                  <button
                    onClick={() => handleAction(order.id, 'CONFIRMED')}
                    disabled={actioningId === order.id}
                    className="px-4 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
                  >
                    Confirm Order
                  </button>
                  <button
                    onClick={() => handleAction(order.id, 'cancel')}
                    disabled={actioningId === order.id}
                    className="px-4 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              )}
              {order.status === 'READY' && (
                <button
                  onClick={() => handleAction(order.id, 'SERVED')}
                  disabled={actioningId === order.id}
                  className="px-4 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Mark Served
                </button>
              )}
              {['CONFIRMED', 'PREPARING'].includes(order.status) && (
                <span className="text-gray-400 text-xs">Waiting on kitchen...</span>
              )}
              {['SERVED', 'CANCELLED'].includes(order.status) && (
                <span className="text-gray-400 text-xs">Complete</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}