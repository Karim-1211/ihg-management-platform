import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const NEXT_STATUS = {
  ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
}

export default function MyDeliveriesPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  function load() {
    api.get('/deliveries/my')
      .then((res) => setDeliveries(res.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function updateStatus(delivery) {
    const next = NEXT_STATUS[delivery.status]
    if (!next) return

    setUpdating(delivery.id)

    try {
      await api.patch(`/deliveries/${delivery.id}/status`, {
        status: next,
      })
      load()
    } finally {
      setUpdating(null)
    }
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="bg-navy text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-9">
            <p className="text-white/60 text-sm">Delivery staff</p>
            <h1 className="text-3xl font-extrabold mt-1">
              My deliveries
            </h1>
          </div>
        </div>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {loading && (
            <p className="text-center text-gray-400 py-16">
              Loading deliveries...
            </p>
          )}

          {!loading && deliveries.length === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center">
              <div className="text-5xl mb-4">🚚</div>
              <h2 className="text-xl font-extrabold text-navy">
                No active deliveries
              </h2>
            </div>
          )}

          <div className="space-y-5">
            {deliveries.map((delivery) => (
              <article
                key={delivery.id}
                className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                      {delivery.order_number || 'Order'}
                    </p>

                    <h2 className="text-xl font-extrabold text-navy mt-1">
                      {delivery.delivery_address || 'Delivery address unavailable'}
                    </h2>

                    <span className="inline-block mt-3 px-3 py-1.5 rounded-full bg-red/10 text-red text-xs font-bold">
                      {delivery.status.replaceAll('_', ' ')}
                    </span>
                  </div>

                  {NEXT_STATUS[delivery.status] && (
                    <button
                      disabled={updating === delivery.id}
                      onClick={() => updateStatus(delivery)}
                      className="bg-navy disabled:opacity-50 text-white rounded-xl px-5 py-3 font-bold"
                    >
                      {updating === delivery.id
                        ? 'Updating...'
                        : `Mark ${NEXT_STATUS[delivery.status].replaceAll('_', ' ')}`}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </AppLayout>
  )
}