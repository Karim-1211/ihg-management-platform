import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_STYLE = {
  PENDING: 'bg-amber-50 text-amber-700',
  ACCEPTED: 'bg-blue-50 text-blue-700',
  IN_PROGRESS: 'bg-indigo-50 text-indigo-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
}

const NEXT_STATUS = { PENDING: 'ACCEPTED', ACCEPTED: 'IN_PROGRESS', IN_PROGRESS: 'COMPLETED' }
const NEXT_LABEL = { PENDING: 'Accept request', ACCEPTED: 'Start', IN_PROGRESS: 'Mark complete' }

// A guest waiting on towels reads very differently from one waiting on food,
// so each type gets its own mark rather than one generic row.
const TYPE_ICON = {
  ROOM_CLEANING: '🧹',
  EXTRA_TOWELS: '🧺',
  FOOD: '🍽️',
  AMENITIES: '🧴',
  WATER: '💧',
  MAINTENANCE: '🔧',
}

function waitingMinutes(value) {
  if (!value) return 0
  return Math.floor((Date.now() - new Date(value).getTime()) / 60000)
}

function waitLabel(mins) {
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function RequestCard({ request, onAdvance, busy, accent }) {
  const mins = waitingMinutes(request.created_at)
  const open = request.status !== 'COMPLETED'
  // 30 minutes is a long time to wait for towels; an hour is too long.
  const urgent = open && mins >= 60
  const warn = open && mins >= 30 && mins < 60
  const bar = request.status === 'COMPLETED' ? '#10B981' : urgent ? '#FF2147' : warn ? '#F59E0B' : accent

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-md">
      <div className="h-1" style={{ background: bar }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-[#1F3A5F] px-2.5 py-1 text-xs font-bold text-white">
                Room {request.room_number || '?'}
              </span>
              {open && (
                <span className={`flex items-center gap-1 text-xs font-bold ${urgent ? 'text-[#FF2147]' : warn ? 'text-amber-600' : 'text-slate-400'}`}>
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  {waitLabel(mins)}
                </span>
              )}
            </div>
            <p className="mt-2.5 text-[15px] font-bold text-[#1F3A5F]">
              <span className="mr-1.5">{TYPE_ICON[request.request_type] || '🔔'}</span>
              {request.request_type.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[request.status]}`}>
            {request.status.replace('_', ' ')}
          </span>
        </div>

        {request.description && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">{request.description}</p>
        )}

        <p className="mt-3 truncate text-xs text-slate-400">
          {request.guest_name || 'Guest'}
          {request.booking_reference ? ` · ${request.booking_reference}` : ''}
          {request.price ? ` · $${Number(request.price).toFixed(2)}` : ''}
        </p>

        {NEXT_STATUS[request.status] && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              onClick={() => onAdvance(request)}
              disabled={busy}
              className={`w-full rounded-xl py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                request.status === 'IN_PROGRESS' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#1F3A5F] hover:bg-[#162f4d]'
              }`}
            >
              {NEXT_LABEL[request.status]}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

export default function ServiceRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showDone, setShowDone] = useState(false)
  const [, forceTick] = useState(0)

  function loadRequests() {
    api.get('/service-requests')
      .then((res) => setRequests(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Could not load service requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRequests()
    const poll = window.setInterval(loadRequests, 20000)
    const tick = window.setInterval(() => forceTick((n) => n + 1), 60000)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [])

  async function handleAdvance(request) {
    const next = NEXT_STATUS[request.status]
    if (!next) return
    setError('')
    setUpdatingId(request.id)
    try {
      await api.patch(`/service-requests/${request.id}`, { status: next })
      loadRequests()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update that request.')
    } finally {
      setUpdatingId(null)
    }
  }

  const query = search.trim().toLowerCase()
  const types = useMemo(() => [...new Set(requests.map((r) => r.request_type))].sort(), [requests])

  const matching = useMemo(
    () => requests.filter((r) => {
      if (typeFilter !== 'all' && r.request_type !== typeFilter) return false
      if (!query) return true
      return `${r.room_number || ''} ${r.guest_name || ''} ${r.description || ''} ${r.booking_reference || ''}`.toLowerCase().includes(query)
    }),
    [requests, query, typeFilter]
  )

  const groups = useMemo(() => {
    // Open requests: oldest first, because the guest waiting longest is the
    // one to serve next. Completed: newest first, as a recent record.
    const oldestFirst = (a, b) => new Date(a.created_at) - new Date(b.created_at)
    const newestFirst = (a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at)

    return [
      { key: 'new', title: 'New requests', hint: 'Waiting longest first', accent: '#FF2147', items: matching.filter((r) => r.status === 'PENDING').sort(oldestFirst) },
      { key: 'active', title: 'Being handled', hint: 'Accepted or under way', accent: '#3B82F6', items: matching.filter((r) => ['ACCEPTED', 'IN_PROGRESS'].includes(r.status)).sort(oldestFirst) },
      { key: 'done', title: 'Completed', hint: 'Recently finished', accent: '#94A3B8', items: matching.filter((r) => r.status === 'COMPLETED').sort(newestFirst) },
    ]
  }, [matching])

  const visibleGroups = showDone ? groups : groups.filter((g) => g.key !== 'done')
  const open = groups[0].items.length + groups[1].items.length

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">Service Requests</h1>
          <p className="mt-1 text-slate-500">Cleaning, towels, food and amenity requests from guests</p>
        </div>
        {open > 0 && (
          <span className="rounded-full bg-[#FF2147]/10 px-4 py-2 text-sm font-bold text-[#FF2147]">
            {open} open request{open === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room, guest or description…"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1F3A5F]"
          />
        </div>
        {types.length > 1 && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
            <option value="all">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${showDone ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'}`}
        >
          {showDone ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && requests.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-20 text-center ring-1 ring-slate-200/80">
          <p className="font-serif text-2xl text-[#1F3A5F]">Nothing outstanding.</p>
          <p className="mt-2 text-sm text-slate-500">No guests are waiting on anything right now.</p>
        </div>
      )}

      <div className="space-y-9">
        {requests.length > 0 && visibleGroups.map((group) => (
          <section key={group.key}>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.accent }} />
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#1F3A5F]">{group.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">{group.items.length}</span>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">{group.hint}</span>
            </div>

            {group.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-400">Nothing here.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((request) => (
                  <RequestCard key={request.id} request={request} accent={group.accent} busy={updatingId === request.id} onAdvance={handleAdvance} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </AppLayout>
  )
}