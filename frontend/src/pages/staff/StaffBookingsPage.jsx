import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import ConfirmDialog from '../../components/shared/ConfirmDialog'

const STATUS_STYLE = {
  PENDING: 'bg-amber-50 text-amber-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  CHECKED_IN: 'bg-emerald-50 text-emerald-700',
  CHECKED_OUT: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-slate-100 text-slate-400',
}

const ACTION_CONFIG = {
  'check-in': {
    endpoint: 'check-in',
    title: 'Check in this guest?',
    message: (b) => `This will check in booking ${b.booking_reference} and mark room ${b.room_number || ''} as occupied.`,
    confirmLabel: 'Check In',
    destructive: false,
  },
  'check-out': {
    endpoint: 'check-out',
    title: 'Check out this guest?',
    message: (b) => `This will check out booking ${b.booking_reference}, generate the final invoice, and send the room to housekeeping.`,
    confirmLabel: 'Check Out',
    destructive: false,
  },
  cancel: {
    endpoint: 'cancel',
    title: 'Cancel this booking?',
    message: (b) => `This will cancel booking ${b.booking_reference}. This cannot be undone, and is subject to the cancellation policy.`,
    confirmLabel: 'Cancel Booking',
    destructive: true,
  },
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function dayDiff(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return Math.round((d - startOfToday()) / 86400000)
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>),
    calendar: (<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function BookingCard({ booking, actioningId, onRequestAction, accent }) {
  const guest = booking.guest_name || booking.account_name || 'Guest'
  const email = booking.guest_email || booking.account_email
  const arriving = dayDiff(booking.check_in_date)
  const busy = actioningId === booking.id

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-md">
      <div className="h-1" style={{ background: accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-[#1F3A5F]">{guest}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">{email || booking.booking_reference}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[booking.status] || 'bg-slate-100'}`}>
            {booking.status.replace('_', ' ')}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="rounded-lg bg-[#1F3A5F] px-2.5 py-1 text-xs font-bold text-white">
            Room {booking.room_number || '—'}
          </span>
          {booking.room_type_name && <span className="text-xs text-slate-500">{booking.room_type_name}</span>}
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
          <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
          {formatDate(booking.check_in_date)} → {formatDate(booking.check_out_date)}
          <span className="text-xs text-slate-400">
            · {booking.nights || 0} night{booking.nights === 1 ? '' : 's'} · {booking.number_of_guests} guest{booking.number_of_guests === 1 ? '' : 's'}
          </span>
        </p>

        {booking.status === 'CONFIRMED' && arriving >= 0 && arriving <= 3 && (
          <p className="mt-2 text-xs font-bold text-[#FF2147]">
            {arriving === 0 ? 'Arriving today' : arriving === 1 ? 'Arriving tomorrow' : `Arriving in ${arriving} days`}
          </p>
        )}

        {booking.special_requests && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs italic leading-5 text-slate-500">
            “{booking.special_requests}”
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <div>
            <span className="font-serif text-xl text-[#1F3A5F]">
              {money(booking.invoice_total ?? booking.total_amount)}
            </span>
            {Number(booking.invoice_discount) > 0 && (
              <span className="ml-2 text-xs font-semibold text-emerald-600">
                −{money(booking.invoice_discount)}
              </span>
            )}
            <span className="ml-2 text-xs text-slate-400">{booking.booking_reference}</span>
          </div>
          <div className="flex gap-2">
            {booking.status === 'CONFIRMED' && (
              <button onClick={() => onRequestAction(booking, 'check-in')} disabled={busy} className="rounded-lg bg-[#1F3A5F] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">
                Check in
              </button>
            )}
            {booking.status === 'CHECKED_IN' && (
              <button onClick={() => onRequestAction(booking, 'check-out')} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                Check out
              </button>
            )}
            {['CONFIRMED', 'CHECKED_IN'].includes(booking.status) && (
              <button onClick={() => onRequestAction(booking, 'cancel')} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function StaffBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioningId, setActioningId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [search, setSearch] = useState('')
  const [showPast, setShowPast] = useState(false)

  function loadBookings() {
    api.get('/bookings')
      .then((res) => setBookings(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Could not load bookings.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadBookings()
  }, [])

  function handleRequestAction(booking, actionKey) {
    setPendingAction({ booking, actionKey })
  }

  async function handleConfirm() {
    if (!pendingAction) return
    const { booking, actionKey } = pendingAction
    const config = ACTION_CONFIG[actionKey]
    setError('')
    setActioningId(booking.id)
    setPendingAction(null)
    try {
      await api.post(`/bookings/${booking.id}/${config.endpoint}`)
      loadBookings()
    } catch (err) {
      setError(err.response?.data?.detail || `Could not ${actionKey.replace('-', ' ')} this booking.`)
    } finally {
      setActioningId(null)
    }
  }

  const activeConfig = pendingAction ? ACTION_CONFIG[pendingAction.actionKey] : null
  const query = search.trim().toLowerCase()

  const matching = useMemo(
    () => bookings.filter((b) => {
      if (!query) return true
      const haystack = `${b.booking_reference} ${b.guest_name || ''} ${b.account_name || ''} ${b.guest_email || ''} ${b.account_email || ''} ${b.room_number || ''}`
      return haystack.toLowerCase().includes(query)
    }),
    [bookings, query]
  )

  // Grouped by what the front desk needs to act on, newest first within each
  // group — the booking just made is the one most likely being discussed.
  const groups = useMemo(() => {
    const newestFirst = (a, b) => new Date(b.created_at) - new Date(a.created_at)

    const inHouse = matching.filter((b) => b.status === 'CHECKED_IN').sort(newestFirst)
    const arrivingToday = matching
      .filter((b) => b.status === 'CONFIRMED' && dayDiff(b.check_in_date) <= 0)
      .sort(newestFirst)
    const upcoming = matching
      .filter((b) => b.status === 'CONFIRMED' && dayDiff(b.check_in_date) > 0)
      .sort((a, b) => new Date(a.check_in_date) - new Date(b.check_in_date))
    const past = matching
      .filter((b) => ['CHECKED_OUT', 'CANCELLED', 'PENDING'].includes(b.status))
      .sort(newestFirst)

    return [
      { key: 'inhouse', title: 'In house', hint: 'Staying now', accent: '#10B981', items: inHouse },
      { key: 'today', title: 'Arriving today', hint: 'Ready to check in', accent: '#FF2147', items: arrivingToday },
      { key: 'upcoming', title: 'Upcoming', hint: 'By arrival date', accent: '#1F3A5F', items: upcoming },
      { key: 'past', title: 'Past & cancelled', hint: 'Closed', accent: '#94A3B8', items: past },
    ]
  }, [matching])

  const visibleGroups = showPast ? groups : groups.filter((g) => g.key !== 'past')
  const revenue = matching
    .filter((b) => b.status !== 'CANCELLED')
    .reduce((sum, b) => sum + Number(b.total_amount || 0), 0)

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1F3A5F]">Bookings</h1>
        <p className="mt-1 text-slate-500">Manage arrivals, stays and departures</p>
      </div>

      {!loading && bookings.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          {groups.map((g) => (
            <div key={g.key} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: g.accent }} />
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">{g.title}</p>
              </div>
              <p className="mt-1 font-serif text-2xl text-[#1F3A5F]">{g.items.length}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest name, email, reference or room…"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1F3A5F]"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowPast((v) => !v)}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${showPast ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'}`}
        >
          {showPast ? 'Hide past' : 'Show past'}
        </button>
        {query && (
          <span className="text-sm text-slate-500">
            {matching.length} match{matching.length === 1 ? '' : 'es'} · {money(revenue)}
          </span>
        )}
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && bookings.length === 0 && <p className="text-slate-500">No bookings yet.</p>}
      {!loading && bookings.length > 0 && matching.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-200/80">
          <p className="text-sm text-slate-500">No bookings match “{search.trim()}”.</p>
          <button type="button" onClick={() => setSearch('')} className="mt-3 text-sm font-bold text-[#1F3A5F] underline">Clear search</button>
        </div>
      )}

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
                {group.items.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    accent={group.accent}
                    actioningId={actioningId}
                    onRequestAction={handleRequestAction}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={!!pendingAction}
        title={activeConfig?.title}
        message={pendingAction ? activeConfig.message(pendingAction.booking) : ''}
        confirmLabel={activeConfig?.confirmLabel}
        destructive={activeConfig?.destructive}
        onConfirm={handleConfirm}
        onCancel={() => setPendingAction(null)}
      />
    </AppLayout>
  )
}