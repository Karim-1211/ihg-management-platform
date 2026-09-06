import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

const NEXT_STATUS = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
}

const NEXT_LABEL = {
  PENDING: 'Accept',
  ACCEPTED: 'Start',
  IN_PROGRESS: 'Complete',
}

export default function ServiceRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  function loadRequests() {
    setLoading(true)
    api.get('/service-requests').then((res) => setRequests(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRequests()
  }, [])

  async function handleAdvance(request) {
    const next = NEXT_STATUS[request.status]
    if (!next) return
    setUpdatingId(request.id)
    try {
      await api.patch(`/service-requests/${request.id}`, { status: next })
      loadRequests()
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Guest Service Requests</h1>
      <p className="text-gray-500 mb-6">Room cleaning, towels, food, and amenity requests from guests</p>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && requests.length === 0 && <p className="text-gray-500">No service requests right now.</p>}

      <div className="space-y-4">
        {requests.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl shadow-md p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-navy text-white text-xs font-bold rounded">
                  Room {r.room_number || '?'}
                </span>
                <span className="text-gray-400 text-xs">{r.booking_reference}</span>
                {r.guest_name && <span className="text-gray-500 text-xs">· {r.guest_name}</span>}
              </div>
              <p className="font-medium text-navy">{r.request_type.replace('_', ' ')}</p>
              {r.description && <p className="text-gray-500 text-sm">{r.description}</p>}
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status]}`}>
                {r.status}
              </span>
            </div>
            {NEXT_STATUS[r.status] && (
              <button
                onClick={() => handleAdvance(r)}
                disabled={updatingId === r.id}
                className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
              >
                {NEXT_LABEL[r.status]}
              </button>
            )}
            {r.status === 'COMPLETED' && <span className="text-gray-400 text-xs">Done</span>}
          </div>
        ))}
      </div>
    </AppLayout>
  )
}