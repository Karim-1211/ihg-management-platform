import { useEffect, useState } from 'react'
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

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orders/my').then((res) => setOrders(res.data)).finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-6">My Orders</h1>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && orders.length === 0 && <p className="text-gray-500">You haven't placed any orders yet.</p>}

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <p className="font-bold text-navy">{order.order_number}</p>
                <p className="text-gray-500 text-sm">
                  {order.order_type.replace('_', ' ')} {order.table_number ? `· Table ${order.table_number}` : ''}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status]}`}>
                {order.status}
              </span>
            </div>

            <div className="space-y-1 text-sm text-gray-600 border-t border-gray-100 pt-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.quantity} × {item.menu_item_name || 'Item'}</span>
                  <span>${item.subtotal}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-bold text-navy pt-3 mt-3 border-t border-gray-100">
              <span>Total</span>
              <span>${order.total_amount}</span>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}