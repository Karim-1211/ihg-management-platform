import { useEffect, useState } from 'react'
import AppLayout from '../../components/layout/AppLayout'
import api from '../../services/api'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState([])
  const [activeOnly, setActiveOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.get('/newsletter/subscribers', { params: { active_only: activeOnly } })
        if (!cancelled) setSubscribers(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.detail || 'Could not load subscribers.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [activeOnly])

  // Downloads via axios rather than a plain link, so the interceptor
  // attaches the bearer token — a bare <a href> or pasted URL would send
  // no credentials and come back 401.
  async function exportCsv() {
    setExporting(true)
    setError('')
    try {
      const res = await api.get('/newsletter/subscribers/export', {
        params: { active_only: activeOnly },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `newsletter_subscribers_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.response?.data?.detail || 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Management</p>
          <h1 className="mt-1 text-3xl font-bold text-navy">Newsletter Subscribers</h1>
          <p className="mt-2 text-sm text-slate-500">
            Everyone who has signed up from the website. Export the list to use in your email tool.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || !subscribers.length}
          className="shrink-0 rounded-xl bg-[#FF2147] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? 'Preparing…' : 'Export CSV'}
        </button>
      </div>

      {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveOnly(true)}
          className={`rounded-full px-4 py-2 text-xs font-bold transition ${activeOnly ? 'bg-navy text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
        >
          Active only
        </button>
        <button
          type="button"
          onClick={() => setActiveOnly(false)}
          className={`rounded-full px-4 py-2 text-xs font-bold transition ${!activeOnly ? 'bg-navy text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}
        >
          Include unsubscribed
        </button>
        {!loading && (
          <span className="ml-auto text-sm text-slate-500">
            {subscribers.length} subscriber{subscribers.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : subscribers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
          No subscribers yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">First name</th>
                  <th className="px-5 py-3">Last name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Zip</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Subscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscribers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 text-slate-700">{s.first_name || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-700">{s.last_name || '—'}</td>
                    <td className="px-5 py-3.5 font-medium text-navy">{s.email}</td>
                    <td className="px-5 py-3.5 text-slate-500">{s.zip_code || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{s.source}</td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {s.is_active ? 'Active' : 'Unsubscribed'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  )
}