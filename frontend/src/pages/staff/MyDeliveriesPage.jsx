import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  ASSIGNED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
}

const NEXT_STATUS = { ASSIGNED: 'PICKED_UP', PICKED_UP: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' }
const NEXT_LABEL = { ASSIGNED: 'Mark Picked Up', PICKED_UP: 'Start Delivery', OUT_FOR_DELIVERY: 'Mark Delivered' }

export default function MyDeliveriesPage() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)

  function loadDeliveries() {
    setLoading(true)
    api.get('/deliveries/my').then((res) => {
      setDeliveries(res.data.filter((d) => d.status !== 'DELIVERED' && d.status !== 'CANCELLED'))
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDeliveries()
  }, [])

  async function handleAdvance(delivery) {
    const next = NEXT_STATUS[delivery.status]
    if (!next) return
    setActioningId(delivery.id)
    try {
      await api.patch(`/deliveries/${delivery.id}/status`, { status: next })
      loadDeliveries()
    } finally {
      setActioningId(null)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">My Deliveries</h1>
      <p className="text-gray-500 mb-6">Your assigned deliveries in progress</p>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && deliveries.length === 0 && <p className="text-gray-500">No active deliveries right now.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {deliveries.map((d) => (
          <div key={d.id} className="bg-white rounded-2xl shadow-lg border-2 border-navy p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-navy">{d.order_number}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[d.status]}`}>
                {d.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-4">{d.delivery_address}</p>
            <button
              onClick={() => handleAdvance(d)}
              disabled={actioningId === d.id}
              className="w-full py-2.5 bg-navy text-white font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
            >
              {NEXT_LABEL[d.status]}
            </button>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}