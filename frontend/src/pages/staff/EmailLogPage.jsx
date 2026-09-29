import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_STYLE = {
  PENDING: 'bg-amber-50 text-amber-700',
  SENT: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-[#FF2147]/10 text-[#FF2147]',
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PENDING', label: 'Queued' },
  { value: 'FAILED', label: 'Failed' },
]

function formatWhen(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export default function EmailLogPage() {
  const [emails, setEmails] = useState([])
  const [mode, setMode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadEmails()
    // The heading must reflect what the platform is actually doing — saying
    // "Demo Mode" while really sending is worse than saying nothing.
    api.get('/health')
      .then((res) => setMode(res.data?.email_mode || null))
      .catch(() => setMode(null))
  }, [])

  function loadEmails() {
    setLoading(true)
    api.get('/notifications/email-log')
      .then((res) => setEmails(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Could not load the email log.'))
      .finally(() => setLoading(false))
  }

  async function handleProcessPending() {
    setProcessing(true)
    setError('')
    setNotice('')
    try {
      const res = await api.post('/notifications/process-pending')
      const { processed = 0, sent = 0, failed = 0 } = res.data || {}
      setNotice(
        processed === 0
          ? 'Nothing was waiting — the queue is already clear.'
          : `${sent} sent, ${failed} failed, out of ${processed} processed.`
      )
      loadEmails()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not process the queue.')
    } finally {
      setProcessing(false)
    }
  }

  const counts = useMemo(() => ({
    SENT: emails.filter((e) => e.status === 'SENT').length,
    PENDING: emails.filter((e) => e.status === 'PENDING').length,
    FAILED: emails.filter((e) => e.status === 'FAILED').length,
  }), [emails])

  const query = search.trim().toLowerCase()
  const visible = emails.filter((e) => {
    if (filter !== 'all' && e.status !== filter) return false
    if (!query) return true
    return `${e.title} ${e.recipient_email} ${e.message}`.toLowerCase().includes(query)
  })

  const isDemo = mode === 'DEMO'

  return (
    <AppLayout>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#1F3A5F]">
          Email Log{mode ? (isDemo ? ' (Demo Mode)' : ' (Live)') : ''}
        </h1>
        <button
          type="button"
          onClick={handleProcessPending}
          disabled={processing}
          className="rounded-xl bg-[#1F3A5F] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#162f4d] disabled:opacity-50"
        >
          {processing ? 'Processing…' : 'Send queued now'}
        </button>
      </div>

      <p className="mb-6 max-w-3xl text-slate-500">
        {mode === null
          ? 'Every email the platform has generated, with its delivery status.'
          : isDemo
            ? 'Demo mode — no real email leaves the platform. This shows exactly what each recipient would have received.'
            : 'Live mode — these are really delivered. Queued messages send automatically within a few seconds; the button above forces an immediate attempt.'}
      </p>

      {emails.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                filter === f.value ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
              {f.value !== 'all' && counts[f.value] > 0 && (
                <span className={filter === f.value ? ' text-white/60' : ' text-slate-400'}> · {counts[f.value]}</span>
              )}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipient or subject…"
            className="ml-auto min-w-[220px] flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-[#1F3A5F] sm:flex-none"
          />
        </div>
      )}

      {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && emails.length === 0 && <p className="text-slate-500">No emails yet.</p>}
      {!loading && emails.length > 0 && visible.length === 0 && (
        <p className="text-slate-500">Nothing matches that filter.</p>
      )}

      <div className="space-y-3">
        {visible.map((email) => (
          <div key={email.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1F3A5F]">{email.title}</p>
                <p className="text-xs text-slate-400">To: {email.recipient_email}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[email.status] || 'bg-slate-100 text-slate-600'}`}>
                {email.status}
              </span>
            </div>
            <p className="text-sm text-slate-600">{email.message}</p>
            {email.failure_reason && (
              <p className="mt-2 rounded-lg bg-[#FF2147]/5 px-3 py-2 text-xs text-[#FF2147]">{email.failure_reason}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {email.attempts} attempt{email.attempts === 1 ? '' : 's'} · queued {formatWhen(email.created_at)}
              {email.sent_at ? ` · sent ${formatWhen(email.sent_at)}` : ''}
            </p>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}