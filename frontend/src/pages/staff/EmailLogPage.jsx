import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

export default function EmailLogPage() {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadEmails()
  }, [])

  function loadEmails() {
    setLoading(true)
    api.get('/notifications/email-log')
      .then((res) => setEmails(res.data))
      .catch(() => setError('Could not load email log.'))
      .finally(() => setLoading(false))
  }

  async function handleProcessPending() {
    setProcessing(true)
    setError('')
    try {
      const res = await api.post('/notifications/process-pending')
      loadEmails()
      return res.data
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not process pending emails.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-2xl font-bold text-navy">Email Log (Demo Mode)</h1>
        <button
          type="button"
          onClick={handleProcessPending}
          disabled={processing}
          className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
        >
          {processing ? 'Processing...' : 'Process Pending Emails'}
        </button>
      </div>
      <p className="text-gray-500 mb-6">
        No real emails are sent — this shows exactly what the platform would have emailed each recipient.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && emails.length === 0 && <p className="text-gray-500">No emails yet.</p>}

      <div className="space-y-3">
        {emails.map((email) => (
          <div key={email.id} className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div>
                <p className="text-sm font-semibold text-navy">{email.title}</p>
                <p className="text-xs text-gray-400">To: {email.recipient_email}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[email.status] || 'bg-gray-100'}`}>
                {email.status}
              </span>
            </div>
            <p className="text-sm text-gray-600">{email.message}</p>
            {email.failure_reason && (
              <p className="text-xs text-red-600 mt-2">Reason: {email.failure_reason}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {email.attempts} attempt(s) · {new Date(email.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}