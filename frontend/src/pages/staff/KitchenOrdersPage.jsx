import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const TYPE_LABEL = { DINE_IN: 'Dine-in', DELIVERY: 'Delivery', ROOM_SERVICE: 'Room service' }

function waitingMinutes(value) {
  if (!value) return 0
  return Math.floor((Date.now() - new Date(value).getTime()) / 60000)
}

function waitLabel(mins) {
  if (mins < 1) return 'just in'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function Ticket({ order, onAdvance, busy, isPreparing }) {
  const mins = waitingMinutes(isPreparing ? order.preparing_started_at || order.created_at : order.created_at)
  // A kitchen cares about the clock above all: amber past 15 minutes, red
  // past 25, so the oldest ticket is impossible to overlook.
  const urgency = mins >= 25 ? '#FF2147' : mins >= 15 ? '#F59E0B' : '#1F3A5F'

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between px-5 py-3" style={{ background: urgency }}>
        <span className="font-bold text-white">{order.order_number}</span>
        <span className="text-sm font-bold text-white/90">{waitLabel(mins)}</span>
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="font-semibold text-slate-500">{TYPE_LABEL[order.order_type] || order.order_type}</span>
          {order.table_number && <span>· Table {order.table_number}</span>}
          {order.customer_name && <span>· {order.customer_name}</span>}
        </div>

        <div className="mt-4 space-y-2">
          {(order.items || []).map((item) => (
            <div key={item.id} className="flex items-baseline gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1F3A5F] text-sm font-bold text-white">
                {item.quantity}
              </span>
              <span className="text-[15px] font-medium leading-6 text-slate-800">{item.menu_item_name || 'Item'}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => onAdvance(order)}
          disabled={busy}
          className={`mt-5 w-full rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50 ${
            isPreparing ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#1F3A5F] hover:bg-[#162f4d]'
          }`}
        >
          {isPreparing ? 'Mark ready' : 'Start preparing'}
        </button>
      </div>
    </article>
  )
}

export default function KitchenOrdersPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)
  const [error, setError] = useState('')
  const [, forceTick] = useState(0)

  const isScopedStaff = user?.role === 'KITCHEN'

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
    loadOrders()
    const poll = window.setInterval(loadOrders, 15000)
    // Redraw every half minute so the waiting times stay honest between polls.
    const tick = window.setInterval(() => forceTick((n) => n + 1), 30000)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadOrders() {
    api.get(`/orders/restaurant/${restaurantId}`)
      .then((res) => setOrders((res.data || []).filter((o) => ['CONFIRMED', 'PREPARING'].includes(o.status))))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load orders.'))
  }

  async function handleAdvance(order) {
    const next = order.status === 'CONFIRMED' ? 'PREPARING' : 'READY'
    setError('')
    setActioningId(order.id)
    try {
      await api.patch(`/orders/${order.id}/status`, { status: next })
      loadOrders()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update that order.')
    } finally {
      setActioningId(null)
    }
  }

  // Oldest first — a kitchen works first-in-first-out, the opposite of the
  // waiters' board, so the longest-waiting ticket is always at the top.
  const queued = useMemo(
    () => orders.filter((o) => o.status === 'CONFIRMED').sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [orders]
  )
  const preparing = useMemo(
    () => orders.filter((o) => o.status === 'PREPARING').sort((a, b) => new Date(a.preparing_started_at || a.created_at) - new Date(b.preparing_started_at || b.created_at)),
    [orders]
  )

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

  const columns = [
    { key: 'queued', title: 'To start', hint: 'Oldest first', orders: queued, preparing: false },
    { key: 'preparing', title: 'On the pass', hint: 'In progress', orders: preparing, preparing: true },
  ]

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">Kitchen</h1>
          <p className="mt-1 text-slate-500">Tickets to prepare, longest waiting first</p>
        </div>
        {!isScopedStaff && (
          <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        )}
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && orders.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-20 text-center ring-1 ring-slate-200/80">
          <p className="font-serif text-2xl text-[#1F3A5F]">All clear.</p>
          <p className="mt-2 text-sm text-slate-500">No orders are waiting on the kitchen right now.</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-2">
          {columns.map((col) => (
            <section key={col.key}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#1F3A5F]">{col.title}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">{col.orders.length}</span>
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">{col.hint}</span>
              </div>
              {col.orders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-400">Nothing here.</p>
              ) : (
                <div className="space-y-4">
                  {col.orders.map((order) => (
                    <Ticket
                      key={order.id}
                      order={order}
                      isPreparing={col.preparing}
                      busy={actioningId === order.id}
                      onAdvance={handleAdvance}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </AppLayout>
  )
}