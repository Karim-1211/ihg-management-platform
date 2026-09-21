import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/AppLayout'
import { useDeliveryCart, setItemQuantity, removeItemsFromCart, clearDeliveryCart, cartCount } from '../../lib/deliveryCart'
import { formatMoney } from '../../lib/deliveryStatus'

const METHODS = [
  { id: 'VISA', label: 'Visa', hint: 'Demo card: 4111 1111 1111 1111' },
  { id: 'MASTERCARD', label: 'Mastercard', hint: 'Demo card: 5555 5555 5555 4444' },
  { id: 'PAYPAL', label: 'PayPal', hint: 'Any email address works in demo mode' },
]

function formatCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

function expiryIsValid(value) {
  const m = value.match(/^(0[1-9]|1[0-2])\/(\d{2})$/)
  if (!m) return false
  const firstOfNextMonth = new Date(2000 + Number(m[2]), Number(m[1]), 1)
  return firstOfNextMonth > new Date()
}

function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1.5 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  )
}

const inputClass = (hasError) =>
  `w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-[#1F3A5F] outline-none transition focus:border-[#1F3A5F] focus:ring-2 focus:ring-[#1F3A5F]/10 ${hasError ? 'border-red-300' : 'border-slate-300'}`

export default function DeliveryCheckoutPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const cart = useDeliveryCart()
  const count = cartCount(cart)

  const [restaurantName, setRestaurantName] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [notice, setNotice] = useState('')

  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState(user?.phone || '')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState('VISA')
  const [cardName, setCardName] = useState(user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [paypalEmail, setPaypalEmail] = useState(user?.email || '')

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const itemsKey = JSON.stringify(cart.items)

  useEffect(() => {
    if (!cart.restaurantId) return
    api.get('/restaurants')
      .then((res) => setRestaurantName((res.data || []).find((r) => r.id === cart.restaurantId)?.name || ''))
      .catch(() => {})
  }, [cart.restaurantId])

  // Totals always come from the server — the same pricing code that will
  // create the order — so what the guest sees is exactly what they pay.
  useEffect(() => {
    if (!cart.restaurantId || !count) { setQuote(null); return undefined }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setQuoteLoading(true)
      setQuoteError('')
      try {
        const res = await api.post('/delivery/quote', {
          restaurant_id: cart.restaurantId,
          items: Object.entries(cart.items).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity })),
        })
        if (cancelled) return
        setQuote(res.data)
        const gone = res.data.unavailable_item_ids || []
        if (gone.length) {
          removeItemsFromCart(gone)
          setNotice(`${gone.length} dish${gone.length === 1 ? ' is' : 'es are'} no longer available and ${gone.length === 1 ? 'has' : 'have'} been removed from your basket.`)
        }
      } catch (err) {
        if (!cancelled) setQuoteError(err.response?.data?.detail || 'We could not price your basket just now. Please try again.')
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [cart.restaurantId, itemsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const lines = useMemo(() => quote?.lines || [], [quote])

  function validate() {
    const e = {}
    if (address.trim().length < 5) e.address = 'Please enter your full delivery address.'
    if (phone.replace(/\D/g, '').length < 7) e.phone = 'Please enter a phone number your rider can call.'
    if (method === 'PAYPAL') {
      if (!/^\S+@\S+\.\S+$/.test(paypalEmail.trim())) e.paypalEmail = 'Enter the email address of your PayPal account.'
    } else {
      const digits = cardNumber.replace(/\D/g, '')
      if (!cardName.trim()) e.cardName = 'Enter the name shown on the card.'
      if (digits.length !== 16) e.cardNumber = 'Card numbers are 16 digits.'
      else if (method === 'VISA' && !digits.startsWith('4')) e.cardNumber = 'Visa card numbers start with 4.'
      else if (method === 'MASTERCARD' && !/^(5[1-5]|2[2-7])/.test(digits)) e.cardNumber = 'Mastercard numbers start with 51–55 or 22–27.'
      if (!expiryIsValid(expiry)) e.expiry = 'Enter a future expiry date as MM/YY.'
      if (!/^\d{3,4}$/.test(cvv)) e.cvv = 'Enter the 3 or 4 digit security code.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function placeOrder(event) {
    event.preventDefault()
    setSubmitError('')
    if (!validate() || !quote || !lines.length) return
    setSubmitting(true)
    try {
      // Card and PayPal details are checked in the browser only and are
      // never sent to the server — only the chosen payment METHOD is.
      const res = await api.post('/delivery/checkout', {
        restaurant_id: cart.restaurantId,
        items: lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity })),
        delivery_address: address.trim(),
        contact_phone: phone.trim(),
        delivery_notes: notes.trim() || null,
        payment_method: method,
      })
      clearDeliveryCart()
      navigate(`/delivery/orders/${res.data.order_id}`, { replace: true, state: { justPlaced: true, receipt: res.data } })
    } catch (err) {
      const detail = err.response?.data?.detail
      setSubmitError(typeof detail === 'string' ? detail : 'We could not place your order. Please check your details and try again.')
      setSubmitting(false)
    }
  }

  if (!count && !submitting) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-lg py-24 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF2147]">Checkout</p>
          <h1 className="mt-3 font-serif text-4xl text-[#1F3A5F]">Your basket is empty.</h1>
          <p className="mt-3 text-slate-500">{notice || 'Add a few dishes from the menu and come back here to pay.'}</p>
          <Link to="/delivery" className="mt-8 inline-block rounded-xl bg-[#FF2147] px-7 py-3.5 text-sm font-bold text-white hover:bg-[#dc1539]">Browse the menu</Link>
        </div>
      </AppLayout>
    )
  }

  const selected = METHODS.find((m) => m.id === method)

  return (
    <AppLayout>
      <div className="relative left-1/2 -ml-[50vw] w-screen -mt-6 lg:-mt-8 bg-[#F5F2ED] pb-24">
        <div className="bg-[#0E2036] px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Link to="/delivery" className="text-xs font-semibold text-white/60 hover:text-white">← Back to the menu</Link>
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.25em] text-[#FF2147]">Checkout</p>
            <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">Almost there.</h1>
            {restaurantName && <p className="mt-2 text-white/60">Delivery from {restaurantName}</p>}
          </div>
        </div>

        <form onSubmit={placeOrder} className="mx-auto -mt-6 grid max-w-[1180px] gap-8 px-4 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
          <div className="space-y-8">
            {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{notice}</div>}

            <section className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200/80 sm:p-9">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F3A5F] text-sm font-bold text-white">1</span>
                <h2 className="font-serif text-2xl text-[#1F3A5F]">Where should we deliver?</h2>
              </div>
              <div className="mt-7 space-y-5">
                <Field label="Delivery address" error={errors.address}>
                  <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, area, building, flat — or your room number if you're staying with us" className={inputClass(errors.address)} />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Phone for your rider" error={errors.phone}>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880 1XXX XXXXXX" className={inputClass(errors.phone)} />
                  </Field>
                  <Field label="Notes for the rider (optional)" hint="Gate code, landmark, leave at reception…">
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className={inputClass(false)} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-slate-200/80 sm:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1F3A5F] text-sm font-bold text-white">2</span>
                  <h2 className="font-serif text-2xl text-[#1F3A5F]">Payment</h2>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">Demo mode</span>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMethod(m.id); setErrors({}) }}
                    className={`rounded-xl border px-3 py-4 text-sm font-bold transition ${method === m.id ? 'border-[#1F3A5F] bg-[#1F3A5F] text-white' : 'border-slate-200 text-[#1F3A5F] hover:border-[#1F3A5F]/40'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-5">
                {method === 'PAYPAL' ? (
                  <Field label="PayPal email" error={errors.paypalEmail} hint={selected.hint}>
                    <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} className={inputClass(errors.paypalEmail)} />
                  </Field>
                ) : (
                  <>
                    <Field label="Name on card" error={errors.cardName}>
                      <input value={cardName} onChange={(e) => setCardName(e.target.value)} autoComplete="cc-name" className={inputClass(errors.cardName)} />
                    </Field>
                    <Field label="Card number" error={errors.cardNumber} hint={selected.hint}>
                      <input inputMode="numeric" value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))} placeholder="0000 0000 0000 0000" autoComplete="cc-number" className={inputClass(errors.cardNumber)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-5">
                      <Field label="Expiry" error={errors.expiry}>
                        <input inputMode="numeric" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" autoComplete="cc-exp" className={inputClass(errors.expiry)} />
                      </Field>
                      <Field label="Security code" error={errors.cvv}>
                        <input inputMode="numeric" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="CVV" autoComplete="cc-csc" className={inputClass(errors.cvv)} />
                      </Field>
                    </div>
                  </>
                )}
              </div>
              <p className="mt-6 text-xs leading-5 text-slate-400">
                Payments run in demo mode — no real money is charged. Card and PayPal details are checked in your browser only and are never sent to our servers.
              </p>
            </section>
          </div>

          <aside className="lg:sticky lg:top-[96px] lg:self-start">
            <div className="rounded-2xl bg-white p-7 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl text-[#1F3A5F]">Your order</h2>
                <Link to="/delivery" className="text-xs font-semibold text-slate-400 underline hover:text-[#1F3A5F]">Add more</Link>
              </div>

              <div className="mt-5 space-y-4">
                {lines.map((line) => (
                  <div key={line.menu_item_id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1F3A5F]">{line.name}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <button type="button" aria-label={`Remove one ${line.name}`} onClick={() => setItemQuantity(cart.restaurantId, line.menu_item_id, line.quantity - 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-[#1F3A5F] hover:bg-slate-200">−</button>
                        <span className="w-4 text-center text-xs font-bold text-[#1F3A5F]">{line.quantity}</span>
                        <button type="button" aria-label={`Add one ${line.name}`} onClick={() => setItemQuantity(cart.restaurantId, line.menu_item_id, line.quantity + 1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FF2147] text-sm font-bold text-white hover:bg-[#dc1539]">+</button>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-700">{formatMoney(line.subtotal)}</span>
                  </div>
                ))}
                {quoteLoading && !lines.length && <div className="h-16 animate-pulse rounded-xl bg-slate-100" />}
              </div>

              {quote && (
                <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-sm">
                  <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatMoney(quote.subtotal)}</span></div>
                  {quote.tax_amount > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatMoney(quote.tax_amount)}</span></div>}
                  {quote.service_charge_amount > 0 && <div className="flex justify-between text-slate-500"><span>Service charge</span><span>{formatMoney(quote.service_charge_amount)}</span></div>}
                  {quote.discount_amount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>−{formatMoney(quote.discount_amount)}</span></div>}
                  <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                    <span className="font-semibold text-[#1F3A5F]">Total</span>
                    <span className="font-serif text-3xl text-[#1F3A5F]">{formatMoney(quote.total_amount)}</span>
                  </div>
                </div>
              )}

              {quoteError && <p className="mt-4 text-sm text-red-600">{quoteError}</p>}
              {submitError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}

              <button
                type="submit"
                disabled={submitting || quoteLoading || !quote || !lines.length}
                className="mt-6 w-full rounded-xl bg-[#FF2147] py-4 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'Placing your order…' : quote ? `Pay & place order · ${formatMoney(quote.total_amount)}` : 'Pay & place order'}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </AppLayout>
  )
}