import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function DeliveryOrderHistoryPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orders/my')
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : []

        setOrders(
          data.filter(
            (order) => order.order_type === 'DELIVERY'
          )
        )
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="bg-navy text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-9">
            <p className="text-white/60 text-sm">Delivery</p>
            <h1 className="text-3xl font-extrabold mt-1">
              My delivery orders
            </h1>
          </div>
        </div>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {loading && (
            <p className="text-gray-400 text-center py-16">
              Loading orders...
            </p>
          )}

          {!loading && orders.length === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center">
              <div className="text-5xl mb-4">🍴</div>
              <h2 className="text-xl font-extrabold text-navy">
                No delivery orders yet
              </h2>
              <Link
                to="/delivery"
                className="inline-block mt-5 bg-red text-white rounded-xl px-6 py-3 font-bold"
              >
                Explore restaurants
              </Link>
            </div>
          )}

          <div className="space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                      Order
                    </p>

                    <h2 className="text-lg font-extrabold text-navy mt-1">
                      {order.order_number || order.id}
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleString()
                        : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-3 py-2 rounded-full bg-gray-100 text-navy text-xs font-bold">
                      {order.status}
                    </span>

                    <Link
                      to={`/delivery/orders/${order.id}/tracking`}
                      className="bg-navy text-white rounded-xl px-4 py-2.5 text-sm font-bold"
                    >
                      Track
                    </Link>
                  </div>
                </div>

                <div className="border-t mt-5 pt-4 flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <strong className="text-navy">
                    ${Number(order.total_amount || 0).toFixed(2)}
                  </strong>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </AppLayout>
  )
}