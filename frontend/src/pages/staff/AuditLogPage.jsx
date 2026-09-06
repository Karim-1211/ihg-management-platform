import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const ACTION_COLORS = {
  CREATE_BOOKING: 'bg-blue-100 text-blue-700',
  CHECK_IN: 'bg-green-100 text-green-700',
  CHECK_OUT: 'bg-gray-100 text-gray-700',
  CANCEL_BOOKING: 'bg-red-100 text-red-700',
  COMPLETE_SERVICE_REQUEST: 'bg-indigo-100 text-indigo-700',
  GENERATE_INVOICE: 'bg-yellow-100 text-yellow-700',
  PAY_INVOICE: 'bg-green-100 text-green-700',
  CREATE_STAFF: 'bg-purple-100 text-purple-700',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/audit-logs').then((res) => setLogs(res.data)).finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Audit Log</h1>
      <p className="text-gray-500 mb-6">A record of key actions across the platform</p>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && logs.length === 0 && <p className="text-gray-500">No activity recorded yet.</p>}

      <div className="bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="divide-y divide-gray-100">
          {logs.map((log) => (
            <div key={log.id} className="p-4 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-1 ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                  {log.action.replace(/_/g, ' ')}
                </span>
                <p className="text-gray-700 text-sm">{log.description}</p>
                <p className="text-gray-400 text-xs mt-0.5">by {log.user_name || 'System'}</p>
              </div>
              <span className="text-gray-400 text-xs whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}