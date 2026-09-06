import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const NEXT_STATUS = { CONFIRMED: 'PREPARING', PREPARING: 'READY' }
const NEXT_LABEL = { CONFIRMED: 'Start Preparing', PREPARING: 'Mark Ready' }

export default function KitchenOrdersPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)

  const isScopedStaff = user?.role === 'KITCHEN'

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
    api.get(`/orders/restaurant/${restaurantId}`).then((res) => {
      setOrders(res.data.filter((o) => ['CONFIRMED', 'PREPARING'].includes(o.status)))
    })
  }

  async function handleAdvance(order) {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    setActioningId(order.id)
    try {
      await api.patch(`/orders/${order.id}/status`, { status: next })
      loadOrders()
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
      <h1 className="text-2xl font-bold text-navy mb-2">Kitchen</h1>
      <p className="text-gray-500 mb-6">Incoming orders to prepare</p>

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
      {!loading && orders.length === 0 && <p className="text-gray-500">No orders waiting on the kitchen.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl shadow-lg border-2 border-navy p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-navy text-lg">{order.order_number}</p>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                {order.status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mb-3">Table {order.table_number || '-'}</p>
            <div className="space-y-1 text-sm mb-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="font-medium">{item.quantity} × {item.menu_item_name}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleAdvance(order)}
              disabled={actioningId === order.id}
              className="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
            >
              {NEXT_LABEL[order.status]}
            </button>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}