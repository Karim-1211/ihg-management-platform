import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_STYLE = {
  CONFIRMED: 'bg-blue-50 text-blue-700',
  SEATED: 'bg-emerald-50 text-emerald-700',
  COMPLETED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-slate-100 text-slate-400',
  NO_SHOW: 'bg-[#FF2147]/10 text-[#FF2147]',
}

const NEXT_ACTIONS = {
  CONFIRMED: [
    { label: 'Seat guests', status: 'SEATED', primary: true },
    { label: 'No-show', status: 'NO_SHOW', primary: false },
  ],
  SEATED: [{ label: 'Complete', status: 'COMPLETED', primary: true }],
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function isToday(value) {
  const d = new Date(value)
  const today = startOfToday()
  return d >= today && d < new Date(today.getTime() + 86400000)
}

function formatTime(value) {
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDay(value) {
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>),
    clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function ReservationCard({ reservation, onAction, busy, accent, showDay }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-md">
      <div className="h-1" style={{ background: accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold text-[#1F3A5F]">Table {reservation.table_number || '—'}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-600">
              <Icon name="users" className="h-3.5 w-3.5 text-slate-400" />
              Party of {reservation.party_size}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[reservation.status]}`}>
            {reservation.status.replace('_', ' ')}
          </span>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[#1F3A5F]">
          <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
          {formatTime(reservation.reservation_start)}
          {showDay && <span className="font-normal text-slate-400">· {formatDay(reservation.reservation_start)}</span>}
        </p>

        {reservation.notes && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs italic leading-5 text-slate-500">
            {reservation.notes}
          </p>
        )}

        {(NEXT_ACTIONS[reservation.status] || []).length > 0 && (
          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
            {NEXT_ACTIONS[reservation.status].map((action) => (
              <button
                key={action.status}
                onClick={() => onAction(reservation.id, action.status)}
                disabled={busy}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                  action.primary
                    ? 'bg-[#1F3A5F] text-white hover:bg-[#162f4d]'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

export default function StaffReservationsPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)

  const isScopedStaff = user?.role === 'WAITER'

  useEffect(() => {
    if (isScopedStaff) {
      setRestaurantId(user.restaurant_id || '')
      setLoading(false)
    } else {
      api.get('/restaurants')
        .then((res) => {
          setRestaurants(res.data)
          if (res.data.length > 0) setRestaurantId(res.data[0].id)
        })
        .catch(() => setError('Could not load the restaurant list.'))
        .finally(() => setLoading(false))
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restaurantId) return undefined
    loadReservations()
    const timer = window.setInterval(loadReservations, 30000)
    return () => window.clearInterval(timer)
  }, [restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadReservations() {
    api.get(`/reservations/restaurant/${restaurantId}`)
      .then((res) => setReservations(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load reservations.'))
  }

  async function handleAction(id, newStatus) {
    setError('')
    setActioningId(id)
    try {
      await api.patch(`/reservations/${id}/status`, { status: newStatus })
      loadReservations()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update that reservation.')
    } finally {
      setActioningId(null)
    }
  }

  const query = search.trim().toLowerCase()

  const matching = useMemo(
    () => reservations.filter((r) => {
      if (!query) return true
      return `${r.table_number || ''} ${r.notes || ''} ${r.party_size}`.toLowerCase().includes(query)
    }),
    [reservations, query]
  )

  // Grouped by what the floor team needs to do next, not by raw status.
  // Today's arrivals come first and sort by time, so the next guest through
  // the door is always at the top.
  const groups = useMemo(() => {
    const today = startOfToday()
    const byTimeAsc = (a, b) => new Date(a.reservation_start) - new Date(b.reservation_start)
    const byTimeDesc = (a, b) => new Date(b.reservation_start) - new Date(a.reservation_start)

    const seated = matching.filter((r) => r.status === 'SEATED').sort(byTimeAsc)
    const arrivingToday = matching
      .filter((r) => r.status === 'CONFIRMED' && isToday(r.reservation_start))
      .sort(byTimeAsc)
    const upcoming = matching
      .filter((r) => r.status === 'CONFIRMED' && new Date(r.reservation_start) >= new Date(today.getTime() + 86400000))
      .sort(byTimeAsc)
    const past = matching
      .filter((r) => ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(r.status)
        || (r.status === 'CONFIRMED' && new Date(r.reservation_start) < today))
      .sort(byTimeDesc)

    return [
      { key: 'seated', title: 'Seated now', hint: 'Dining', accent: '#10B981', items: seated, showDay: false },
      { key: 'today', title: 'Arriving today', hint: 'By time', accent: '#FF2147', items: arrivingToday, showDay: false },
      { key: 'upcoming', title: 'Upcoming', hint: 'Later dates', accent: '#1F3A5F', items: upcoming, showDay: true },
      { key: 'past', title: 'Past & cancelled', hint: 'Closed', accent: '#94A3B8', items: past, showDay: true },
    ]
  }, [matching])

  const visibleGroups = showPast ? groups : groups.filter((g) => g.key !== 'past')

  if (isScopedStaff && !user.restaurant_id) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <h2 className="mb-2 text-xl font-bold text-[#1F3A5F]">Not assigned</h2>
          <p className="text-slate-500">Your account isn't assigned to a restaurant yet. Contact your manager.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1F3A5F]">Reservations</h1>
        <p className="mt-1 text-slate-500">Seat guests and manage table reservations</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search table, party size or notes…"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1F3A5F]"
          />
        </div>
        {!isScopedStaff && (
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${showPast ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'}`}
        >
          {showPast ? 'Hide past' : 'Show past'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && reservations.length === 0 && <p className="text-slate-500">No reservations yet.</p>}

      <div className="space-y-9">
        {visibleGroups.map((group) => (
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
                {group.items.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    accent={group.accent}
                    showDay={group.showDay}
                    busy={actioningId === reservation.id}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </AppLayout>
  )
}