import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import { reorderIntoCart } from '../../lib/deliveryCart'
import { isFinished, statusLabel, statusPillClass, formatMoney, formatDateTime, summariseItems } from '../../lib/deliveryStatus'

function OrderCard({ order, onReorder, reordering }) {
  return (
    <article className="rounded-2xl bg-white p-6 ring-1 ring-slate-200/80 transition hover:shadow-lg sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{formatDateTime(order.created_at)}</p>
          <p className="mt-1 font-serif text-2xl text-[#1F3A5F]">Order {order.order_number}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${statusPillClass(order)}`}>{statusLabel(order)}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{summariseItems(order)}</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
        <span className="font-serif text-2xl text-[#1F3A5F]">{formatMoney(order.total_amount)}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => onReorder(order)} disabled={reordering} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-[#1F3A5F] hover:bg-slate-50 disabled:opacity-50">Order again</button>
          <Link to={`/delivery/orders/${order.id}`} className="rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#162f4d]">
            {isFinished(order) ? 'View order' : 'Track order'}
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function DeliveryOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reorderingId, setReorderingId] = useState(null)

  useEffect(() => {
    api.get('/orders/my')
      .then((res) => setOrders((Array.isArray(res.data) ? res.data : []).filter((o) => o.order_type === 'DELIVERY')))
      .catch(() => setError('We could not load your orders just now.'))
      .finally(() => setLoading(false))
  }, [])

  const active = useMemo(() => orders.filter((o) => !isFinished(o)), [orders])
  const past = useMemo(() => orders.filter((o) => isFinished(o)), [orders])

  async function reorder(order) {
    setReorderingId(order.id)
    try {
      const { skipped } = await reorderIntoCart(order)
      navigate('/delivery', { state: { reordered: true, reorderSkipped: skipped } })
    } catch {
      setReorderingId(null)
    }
  }

  return (
    <AppLayout>
      <div className="relative left-1/2 -ml-[50vw] w-screen -mt-6 lg:-mt-8 min-h-[70vh] bg-[#F5F2ED] pb-24">
        <div className="bg-[#0E2036] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1000px]">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#FF2147]">Delivery</p>
            <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">Your orders</h1>
            <p className="mt-2 text-white/60">Track what's on its way, or order a favourite again.</p>
          </div>
        </div>

        <div className="mx-auto max-w-[1000px] px-4 pt-12 sm:px-6 lg:px-8">
          {loading && <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-44 animate-pulse rounded-2xl bg-white/70" />)}</div>}
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

          {!loading && !error && orders.length === 0 && (
            <div className="rounded-2xl bg-white px-6 py-20 text-center ring-1 ring-slate-200/80">
              <p className="font-serif text-3xl text-[#1F3A5F]">No delivery orders yet.</p>
              <p className="mt-2 text-slate-500">When you order, you'll be able to follow it here from kitchen to door.</p>
              <Link to="/delivery" className="mt-8 inline-block rounded-xl bg-[#FF2147] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#dc1539]">Browse the menu</Link>
            </div>
          )}

          {active.length > 0 && (
            <section className="mb-12">
              <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">On the way</h2>
              <div className="space-y-4">
                {active.map((o) => <OrderCard key={o.id} order={o} onReorder={reorder} reordering={reorderingId === o.id} />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Past orders</h2>
              <div className="space-y-4">
                {past.map((o) => <OrderCard key={o.id} order={o} onReorder={reorder} reordering={reorderingId === o.id} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </AppLayout>
  )
}