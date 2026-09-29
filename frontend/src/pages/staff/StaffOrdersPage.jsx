import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

// Grouped by what each order NEEDS, not by raw status — a waiter scanning
// this page is asking "what wants my attention right now?"
const GROUPS = [
  { key: 'new', title: 'Needs confirming', statuses: ['NEW'], accent: '#FF2147', hint: 'Waiting on you' },
  { key: 'kitchen', title: 'With the kitchen', statuses: ['CONFIRMED', 'PREPARING'], accent: '#6366F1', hint: 'Being prepared' },
  { key: 'ready', title: 'Ready to serve', statuses: ['READY'], accent: '#10B981', hint: 'Collect now' },
  { key: 'done', title: 'Completed', statuses: ['SERVED', 'CANCELLED'], accent: '#94A3B8', hint: 'Closed' },
]

const STATUS_STYLE = {
  NEW: 'bg-[#FF2147]/10 text-[#FF2147]',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PREPARING: 'bg-indigo-50 text-indigo-700',
  READY: 'bg-emerald-50 text-emerald-700',
  SERVED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-slate-100 text-slate-400',
}

const TYPE_LABEL = { DINE_IN: 'Dine-in', DELIVERY: 'Delivery', ROOM_SERVICE: 'Room service' }

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function timeAgo(value) {
  if (!value) return ''
  const mins = Math.floor((Date.now() - new Date(value).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function OrderCard({ order, onAction, busy, accent }) {
  const items = order.items || []
  const count = order.item_count ?? items.reduce((n, i) => n + i.quantity, 0)
  // Long-waiting orders earn a nudge: anything unconfirmed past 10 minutes.
  const stale = order.status === 'NEW' && (Date.now() - new Date(order.created_at).getTime()) > 600000

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-md">
      <div className="h-1" style={{ background: accent }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-[#1F3A5F]">{order.order_number}</p>
            <p className="mt-0.5 truncate text-sm text-slate-600">
              {order.customer_name || 'Walk-in guest'}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[order.status]}`}>
            {order.status}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span className="font-semibold text-slate-500">{TYPE_LABEL[order.order_type] || order.order_type}</span>
          {order.table_number && <span>· Table {order.table_number}</span>}
          <span>· {count} dish{count === 1 ? '' : 'es'}</span>
          <span className={stale ? '· font-bold text-[#FF2147]' : ''}>· {timeAgo(order.created_at)}</span>
        </div>

        {items.length > 0 && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
            {items.map((i) => `${i.quantity}× ${i.menu_item_name || 'Item'}`).join(', ')}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="font-serif text-xl text-[#1F3A5F]">{money(order.total_amount)}</span>
          <div className="flex gap-2">
            {order.status === 'NEW' && (
              <>
                <button onClick={() => onAction(order.id, 'CANCELLED')} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  Cancel
                </button>
                <button onClick={() => onAction(order.id, 'CONFIRMED')} disabled={busy} className="rounded-lg bg-[#1F3A5F] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">
                  Confirm
                </button>
              </>
            )}
            {order.status === 'READY' && order.order_type !== 'DELIVERY' && (
              <button onClick={() => onAction(order.id, 'SERVED')} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                Mark served
              </button>
            )}
            {order.status === 'READY' && order.order_type === 'DELIVERY' && (
              <span className="text-xs text-slate-400">Awaiting rider</span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function StaffOrdersPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [actioningId, setActioningId] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showDone, setShowDone] = useState(false)

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
    loadOrders()
    // Kitchen and guests move orders along constantly, so the board keeps
    // itself current rather than relying on a manual refresh.
    const timer = window.setInterval(loadOrders, 20000)
    return () => window.clearInterval(timer)
  }, [restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadOrders() {
    api.get(`/orders/restaurant/${restaurantId}`)
      .then((res) => setOrders(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load orders.'))
  }

  async function handleAction(orderId, newStatus) {
    setError('')
    setActioningId(orderId)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: newStatus })
      loadOrders()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update that order.')
    } finally {
      setActioningId(null)
    }
  }

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return orders
      .filter((o) => {
        if (typeFilter !== 'all' && o.order_type !== typeFilter) return false
        if (!query) return true
        return `${o.order_number} ${o.customer_name || ''} ${o.table_number || ''}`.toLowerCase().includes(query)
      })
      // Newest first, so the order just placed is the one you see.
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [orders, query, typeFilter])

  const grouped = GROUPS.map((g) => ({ ...g, orders: filtered.filter((o) => g.statuses.includes(o.status)) }))
  const visibleGroups = showDone ? grouped : grouped.filter((g) => g.key !== 'done')

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
        <h1 className="text-2xl font-bold text-[#1F3A5F]">Orders</h1>
        <p className="mt-1 text-slate-500">Confirm new orders and serve completed ones</p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order number, guest or table…"
          className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
          <option value="all">All types</option>
          <option value="DINE_IN">Dine-in</option>
          <option value="DELIVERY">Delivery</option>
        </select>
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
          {showDone ? 'Hide completed' : 'Show completed'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && orders.length === 0 && <p className="text-slate-500">No orders yet.</p>}

      <div className="space-y-9">
        {visibleGroups.map((group) => (
          <section key={group.key}>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.accent }} />
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#1F3A5F]">{group.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">{group.orders.length}</span>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">{group.hint}</span>
            </div>

            {group.orders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-400">Nothing here.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    accent={group.accent}
                    busy={actioningId === order.id}
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