import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  DONE: 'bg-green-100 text-green-700',
}

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  function loadTasks() {
    setLoading(true)
    api.get('/housekeeping/tasks')
      .then((res) => setTasks(res.data))
      .catch(() => setError('Could not load tasks.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTasks()
  }, [])

  async function handleUpdateStatus(taskId, status) {
    setError('')
    setUpdatingId(taskId)
    try {
      await api.patch(`/housekeeping/tasks/${taskId}`, { status })
      loadTasks()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update task.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Housekeeping Tasks</h1>
      <p className="text-gray-500 mb-6">Rooms awaiting cleaning after checkout</p>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && tasks.length === 0 && <p className="text-gray-500">No housekeeping tasks right now.</p>}

      <div className="space-y-4">
        {tasks.map((task) => (
          <div key={task.id} className="bg-white rounded-2xl shadow-md p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="inline-block px-2 py-0.5 bg-navy text-white text-xs font-bold rounded mb-1">
                Room {task.room_number || '?'}
              </span>
              <p className="text-gray-700 text-sm">{task.notes}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[task.status]}`}>
                {task.status}
              </span>
            </div>
            <div className="flex gap-2">
              {task.status === 'PENDING' && (
                <button
                  onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                  disabled={updatingId === task.id}
                  className="px-4 py-2 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
                >
                  Start Cleaning
                </button>
              )}
              {task.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => handleUpdateStatus(task.id, 'DONE')}
                  disabled={updatingId === task.id}
                  className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Mark Done
                </button>
              )}
              {task.status === 'DONE' && (
                <span className="text-gray-400 text-xs">Room is ready</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}