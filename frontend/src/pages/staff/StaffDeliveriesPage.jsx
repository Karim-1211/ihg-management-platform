import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_STYLE = {
  PENDING: 'bg-amber-50 text-amber-700',
  ASSIGNED: 'bg-blue-50 text-blue-700',
  PICKED_UP: 'bg-indigo-50 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-violet-50 text-violet-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-400',
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
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    pin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
    clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
    rider: (<><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 18h6M15 18V7a2 2 0 0 1 2-2h2M6 15V9h5l3 6" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function DeliveryCard({ delivery, drivers, selectedDriver, onSelectDriver, onAssign, assigning, accent }) {
  const mins = waitingMinutes(delivery.created_at)
  const open = !['DELIVERED', 'CANCELLED'].includes(delivery.status)
  const stale = open && mins >= 1440
  // A delivery order sitting unassigned past 20 minutes is the one thing a
  // dispatcher must act on, so that alone earns red.
  const late = delivery.status === 'PENDING' && !stale && mins >= 20
  const edge = stale ? '#CBD5E1' : late ? '#FF2147' : accent

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-md">
      <div className="h-1" style={{ background: edge }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[#1F3A5F]">{delivery.order_number}</p>
            <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-5 text-slate-600">
              <span className="mt-0.5 shrink-0 text-slate-400"><Icon name="pin" className="h-3.5 w-3.5" /></span>
              <span className="line-clamp-2">{delivery.delivery_address || 'No address given'}</span>
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[delivery.status]}`}>
            {delivery.status.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {open && (
            <span className={`flex items-center gap-1.5 font-semibold ${late ? 'text-[#FF2147]' : 'text-slate-400'}`}>
              <Icon name="clock" className="h-3.5 w-3.5" />
              {waitLabel(mins)}{late ? ' — needs a rider' : ''}
            </span>
          )}
          {delivery.driver_name && (
            <span className="flex items-center gap-1.5 font-semibold text-slate-600">
              <Icon name="rider" className="h-3.5 w-3.5 text-slate-400" />
              {delivery.driver_name}
            </span>
          )}
        </div>

        {delivery.status === 'PENDING' && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <select
              value={selectedDriver || ''}
              onChange={(e) => onSelectDriver(delivery.id, e.target.value)}
              className="min-w-[150px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#1F3A5F]"
            >
              <option value="">Choose a rider…</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>{driver.first_name} {driver.last_name}</option>
              ))}
            </select>
            <button
              onClick={() => onAssign(delivery.id)}
              disabled={assigning || !drivers.length}
              className="rounded-lg bg-[#1F3A5F] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#162f4d] disabled:opacity-50"
            >
              {assigning ? 'Assigning…' : 'Dispatch'}
            </button>
          </div>
        )}

        {delivery.status === 'DELIVERED' && delivery.delivered_at && (
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            Delivered {new Date(delivery.delivered_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>
    </article>
  )
}

export default function StaffDeliveriesPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [deliveries, setDeliveries] = useState([])
  const [drivers, setDrivers] = useState([])
  const [selectedDriver, setSelectedDriver] = useState({})
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [, forceTick] = useState(0)

  // Super admins and managers aren't tied to one restaurant, so they pick
  // which one to work on — the same pattern every other staff page uses.
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
    loadDeliveries()
    api.get(`/restaurants/${restaurantId}/drivers`)
      .then((res) => setDrivers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDrivers([]))

    const poll = window.setInterval(loadDeliveries, 20000)
    const tick = window.setInterval(() => forceTick((n) => n + 1), 60000)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadDeliveries() {
    api.get(`/deliveries/restaurant/${restaurantId}`)
      .then((res) => setDeliveries(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load deliveries.'))
  }

  async function handleAssign(deliveryId) {
    const driverId = selectedDriver[deliveryId]
    if (!driverId) {
      setError('Choose a rider first.')
      return
    }
    setError('')
    setAssigningId(deliveryId)
    try {
      await api.patch(`/deliveries/${deliveryId}/assign`, { driver_id: driverId })
      loadDeliveries()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not assign that rider.')
    } finally {
      setAssigningId(null)
    }
  }

  const query = search.trim().toLowerCase()

  const matching = useMemo(
    () => deliveries.filter((d) => {
      if (!query) return true
      return `${d.order_number} ${d.delivery_address || ''} ${d.driver_name || ''}`.toLowerCase().includes(query)
    }),
    [deliveries, query]
  )

  // Grouped by dispatch stage, so a dispatcher sees at a glance what needs a
  // rider, what is with the kitchen, and what is already on the road.
  const groups = useMemo(() => {
    const oldestFirst = (a, b) => new Date(a.created_at) - new Date(b.created_at)
    const newestFirst = (a, b) => new Date(b.created_at) - new Date(a.created_at)

    return [
      { key: 'pending', title: 'Needs a rider', hint: 'Waiting longest first', accent: '#F59E0B', items: matching.filter((d) => d.status === 'PENDING').sort(oldestFirst) },
      { key: 'assigned', title: 'Rider assigned', hint: 'Collecting from the kitchen', accent: '#3B82F6', items: matching.filter((d) => d.status === 'ASSIGNED').sort(oldestFirst) },
      { key: 'road', title: 'On the road', hint: 'Out with a rider', accent: '#8B5CF6', items: matching.filter((d) => ['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(d.status)).sort(oldestFirst) },
      { key: 'done', title: 'Delivered & cancelled', hint: 'Closed', accent: '#94A3B8', items: matching.filter((d) => ['DELIVERED', 'CANCELLED'].includes(d.status)).sort(newestFirst) },
    ]
  }, [matching])

  const visibleGroups = showDone ? groups : groups.filter((g) => g.key !== 'done')
  const waiting = groups[0].items.length

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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">Deliveries</h1>
          <p className="mt-1 text-slate-500">Dispatch riders and follow orders to the door</p>
        </div>
        {waiting > 0 && (
          <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700">
            {waiting} waiting for a rider
          </span>
        )}
      </div>

      {!loading && deliveries.length > 0 && (
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
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order, address or rider…"
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
          onClick={() => setShowDone((v) => !v)}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${showDone ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'}`}
        >
          {showDone ? 'Hide closed' : 'Show closed'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && deliveries.length > 0 && drivers.length === 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No riders are assigned to this restaurant, so nothing can be dispatched. Run <code className="rounded bg-amber-100 px-1.5 py-0.5">python seed_tables_and_drivers.py</code> to add them.
        </div>
      )}

      {!loading && deliveries.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-20 text-center ring-1 ring-slate-200/80">
          <p className="font-serif text-2xl text-[#1F3A5F]">No deliveries yet.</p>
          <p className="mt-2 text-sm text-slate-500">Delivery orders will appear here as guests place them.</p>
        </div>
      )}

      <div className="space-y-9">
        {deliveries.length > 0 && visibleGroups.map((group) => (
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
                {group.items.map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    drivers={drivers}
                    accent={group.accent}
                    selectedDriver={selectedDriver[delivery.id]}
                    onSelectDriver={(id, value) => setSelectedDriver((prev) => ({ ...prev, [id]: value }))}
                    onAssign={handleAssign}
                    assigning={assigningId === delivery.id}
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