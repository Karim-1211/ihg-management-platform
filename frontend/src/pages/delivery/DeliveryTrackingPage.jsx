import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import { reorderIntoCart } from '../../lib/deliveryCart'
import {
  DELIVERY_STEPS, deliveryStepIndex, isCancelled, isFinished,
  statusHeadline, formatMoney, formatDateTime,
} from '../../lib/deliveryStatus'

const POLL_MS = 15000

function stepTime(order, key) {
  if (key === 'placed') return order.created_at
  if (key === 'onTheWay') return order.delivery_picked_up_at
  if (key === 'delivered') return order.delivery_delivered_at
  return null
}

export default function DeliveryTrackingPage() {
  const { orderId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const justPlaced = !!location.state?.justPlaced
  const receipt = location.state?.receipt || null

  const [order, setOrder] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reordering, setReordering] = useState(false)

  // Refreshes itself every 15 seconds until the order is delivered or
  // cancelled, then stops — no needless polling on finished orders.
  useEffect(() => {
    let cancelled = false
    let timer

    async function tick() {
      try {
        const res = await api.get(`/orders/${orderId}`)
        if (cancelled) return
        setOrder(res.data)
        setError('')
        if (!isFinished(res.data)) timer = window.setTimeout(tick, POLL_MS)
      } catch (err) {
        if (!cancelled) setError(err.response?.status === 404 ? 'We could not find that order on your account.' : 'We could not load this order just now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    tick()
    api.get(`/restaurant-invoices/order/${orderId}`).then((res) => { if (!cancelled) setInvoice(res.data) }).catch(() => {})
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [orderId])

  async function orderAgain() {
    if (!order) return
    setReordering(true)
    try {
      const { skipped } = await reorderIntoCart(order)
      navigate('/delivery', { state: { reordered: true, reorderSkipped: skipped } })
    } catch {
      setReordering(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl space-y-4 py-16">
          <div className="h-10 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </AppLayout>
    )
  }

  if (error || !order) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg py-24 text-center">
          <h1 className="font-serif text-3xl text-[#1F3A5F]">{error || 'Order not found.'}</h1>
          <Link to="/delivery/orders" className="mt-6 inline-block text-sm font-bold text-[#1F3A5F] underline">View all your orders</Link>
        </div>
      </AppLayout>
    )
  }

  const step = deliveryStepIndex(order)
  const cancelled = isCancelled(order)
  const live = !isFinished(order)
  const paid = invoice?.status === 'PAID'

  return (
    <AppLayout>
      <div className="relative left-1/2 -ml-[50vw] w-screen -mt-6 lg:-mt-8 bg-[#F5F2ED] pb-24">
        <div className="bg-[#0E2036] px-4 pb-20 pt-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1100px]">
            <Link to="/delivery/orders" className="text-xs font-semibold text-white/60 hover:text-white">← All orders</Link>
            {justPlaced && (
              <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-emerald-500/15 px-4 py-2 text-sm text-emerald-200 ring-1 ring-emerald-400/30">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-white">✓</span>
                Thank you — your order is placed and paid.
              </div>
            )}
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.25em] text-[#FF2147]">Order {order.order_number}</p>
            <h1 className="mt-2 max-w-3xl font-serif text-4xl leading-tight text-white sm:text-5xl">{statusHeadline(order)}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
              <span>Placed {formatDateTime(order.created_at)}</span>
              {live && (
                <span className="flex items-center gap-2 text-white/80">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF2147] opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF2147]" /></span>
                  Live — updates automatically
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto -mt-12 max-w-[1100px] space-y-8 px-4 sm:px-6 lg:px-8">
          <section className="rounded-2xl bg-white p-7 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 sm:p-10">
            {cancelled ? (
              <div className="text-center">
                <p className="font-serif text-2xl text-[#1F3A5F]">This order was cancelled.</p>
                <p className="mt-2 text-sm text-slate-500">If you were charged, the payment will be reversed. Questions? Ask Alice or contact reception.</p>
              </div>
            ) : (
              <ol className="grid gap-6 md:grid-cols-6 md:gap-2">
                {DELIVERY_STEPS.map((s, i) => {
                  const done = i < step || (i === step && step === 5)
                  const current = i === step && step !== 5
                  const time = stepTime(order, s.key)
                  return (
                    <li key={s.key} className="relative flex gap-4 md:flex-col md:items-center md:gap-3 md:text-center">
                      {i < DELIVERY_STEPS.length - 1 && (
                        <span className={`absolute left-[15px] top-9 h-[calc(100%-12px)] w-[2px] md:left-[calc(50%+22px)] md:top-[15px] md:h-[2px] md:w-[calc(100%-44px)] ${i < step ? 'bg-[#FF2147]' : 'bg-slate-200'}`} />
                      )}
                      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-[#FF2147] text-white' : current ? 'bg-[#1F3A5F] text-white ring-4 ring-[#1F3A5F]/15' : 'bg-slate-100 text-slate-400'}`}>
                        {done ? '✓' : i + 1}
                      </span>
                      <div>
                        <p className={`text-sm font-bold ${done || current ? 'text-[#1F3A5F]' : 'text-slate-400'}`}>{s.label}</p>
                        {current && <p className="mt-1 text-xs leading-5 text-slate-500">{s.detail}</p>}
                        {time && (done || current) && <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(time)}</p>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {order.delivery_driver_name && !cancelled && step < 5 && (
              <div className="mt-8 rounded-xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
                Your rider is <span className="font-bold text-[#1F3A5F]">{order.delivery_driver_name}</span>.
              </div>
            )}
          </section>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <section className="rounded-2xl bg-white p-7 ring-1 ring-slate-200/80 sm:p-9">
              <h2 className="font-serif text-2xl text-[#1F3A5F]">What you ordered</h2>
              <div className="mt-6 space-y-3">
                {(order.items || []).map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <span className="text-slate-700">{item.quantity} × {item.menu_item_name || 'Item'}</span>
                    <span className="font-semibold text-slate-700">{formatMoney(item.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-sm">
                <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
                {Number(order.tax_amount) > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatMoney(order.tax_amount)}</span></div>}
                {Number(order.service_charge_amount) > 0 && <div className="flex justify-between text-slate-500"><span>Service charge</span><span>{formatMoney(order.service_charge_amount)}</span></div>}
                {Number(order.discount_amount) > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-600">
                    <span>Subscriber discount</span>
                    <span>−{formatMoney(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="font-semibold text-[#1F3A5F]">Total</span>
                  <span className="font-serif text-3xl text-[#1F3A5F]">{formatMoney(order.total_amount)}</span>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-2xl bg-white p-7 ring-1 ring-slate-200/80">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Delivering to</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#1F3A5F]">{order.delivery_address || '—'}</p>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Payment</p>
                <p className="mt-2 text-sm text-[#1F3A5F]">
                  {paid ? 'Paid in full' : invoice ? `Invoice ${invoice.status?.toLowerCase().replace('_', ' ')}` : 'Payment details unavailable'}
                  {receipt?.payment_method ? ` · ${receipt.payment_method.charAt(0)}${receipt.payment_method.slice(1).toLowerCase()}` : ''}
                </p>
                {(invoice?.invoice_number || receipt?.invoice_number) && (
                  <p className="mt-1 text-xs text-slate-400">Invoice {invoice?.invoice_number || receipt?.invoice_number}</p>
                )}
              </div>
              <button type="button" onClick={orderAgain} disabled={reordering} className="w-full rounded-xl bg-[#FF2147] py-3.5 text-sm font-bold text-white hover:bg-[#dc1539] disabled:opacity-50">
                {reordering ? 'Adding to your basket…' : 'Order this again'}
              </button>
              <Link to="/delivery" className="block w-full rounded-xl border border-slate-300 bg-white py-3.5 text-center text-sm font-bold text-[#1F3A5F] hover:bg-slate-50">
                Back to the menu
              </Link>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}