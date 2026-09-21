import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/AppLayout'
import DiningConcierge from '../../components/restaurants/DiningConcierge'
import { useDeliveryCart, getDeliveryCart, setItemQuantity, clearDeliveryCart, cartCount } from '../../lib/deliveryCart'
import { formatMoney } from '../../lib/deliveryStatus'

const CONTENT_MAX_W = 'max-w-[1280px]'

// Licence-verified plated-food photography (Pexels + Unsplash).
const HERO_IMAGES = [
  'https://images.pexels.com/photos/8697542/pexels-photo-8697542.jpeg?auto=compress&cs=tinysrgb&w=2400',
  'https://images.pexels.com/photos/3791089/pexels-photo-3791089.jpeg?auto=compress&cs=tinysrgb&w=2400',
  'https://images.unsplash.com/photo-1660380775592-5647075c8ea0?fm=jpg&q=80&w=2400&auto=format&fit=crop',
  'https://images.pexels.com/photos/299348/pexels-photo-299348.jpeg?auto=compress&cs=tinysrgb&w=2400',
]

const MOTIONS = ['heroZoomIn', 'heroPanLeft', 'heroPanRight', 'heroZoomOut']
const DIET_FILTERS = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free']
const TAG_ABBR = { 'Gluten-Free': 'GF', 'Dairy-Free': 'DF', Vegetarian: 'VG', Vegan: 'V', 'Contains Nuts': 'N', Spicy: '🌶' }

function Icon({ name, size = 18 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    bag: (<><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
    chef: (<><path d="M6 13a4 4 0 1 1 2-7.5 4.5 4.5 0 0 1 8 0A4 4 0 1 1 18 13v6H6v-6Z" /><path d="M6 17h12" /></>),
    scooter: (<><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 18h6M15 18V7a2 2 0 0 1 2-2h2M6 15V9h5l3 6" /></>),
    sparkle: (<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />),
    arrowDown: (<path d="M12 5v14M19 12l-7 7-7-7" />),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function CinematicHero({ images }) {
  const [index, setIndex] = useState(0)
  const CYCLE_MS = 6000

  useEffect(() => {
    if (images.length <= 1) return undefined
    const t = window.setInterval(() => setIndex((c) => (c + 1) % images.length), CYCLE_MS)
    return () => window.clearInterval(t)
  }, [images.length])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes heroZoomIn  { from { transform: scale(1)    translate3d(0,0,0); }     to { transform: scale(1.14) translate3d(0,0,0); } }
        @keyframes heroZoomOut { from { transform: scale(1.14) translate3d(0,0,0); }     to { transform: scale(1)    translate3d(0,0,0); } }
        @keyframes heroPanLeft { from { transform: scale(1.14) translate3d(3.5%,0,0); }  to { transform: scale(1.14) translate3d(-3.5%,0,0); } }
        @keyframes heroPanRight{ from { transform: scale(1.14) translate3d(-3.5%,0,0); } to { transform: scale(1.14) translate3d(3.5%,0,0); } }
      `}</style>
      {images.map((src, i) => (
        <img
          key={`${src}-${i === index ? 'on' : 'off'}`}
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1100ms]"
          style={{
            opacity: i === index ? 1 : 0,
            animation: i === index ? `${MOTIONS[i % MOTIONS.length]} ${CYCLE_MS + 1100}ms linear forwards` : 'none',
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  )
}

function QuantityControl({ quantity, onChange, name, size = 'md' }) {
  const box = size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-base'
  if (!quantity) {
    return (
      <button type="button" onClick={() => onChange(1)} className="rounded-full bg-[#1F3A5F] px-5 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-[#FF2147]">
        Add +
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2.5">
      <button type="button" aria-label={`Remove one ${name}`} onClick={() => onChange(quantity - 1)} className={`flex ${box} items-center justify-center rounded-full bg-slate-100 font-bold text-[#1F3A5F] transition hover:bg-slate-200`}>−</button>
      <span className="w-5 text-center text-sm font-bold text-[#1F3A5F]">{quantity}</span>
      <button type="button" aria-label={`Add one ${name}`} onClick={() => onChange(quantity + 1)} className={`flex ${box} items-center justify-center rounded-full bg-[#FF2147] font-bold text-white transition hover:bg-[#dc1539]`}>+</button>
    </div>
  )
}

function DishCard({ item, categoryName, quantity, onChange }) {
  return (
    <article className={`flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 transition ${quantity ? 'shadow-[0_18px_40px_-24px_rgba(255,33,71,0.55)] ring-[#FF2147]/40' : 'ring-slate-200/80 hover:shadow-lg hover:ring-[#1F3A5F]/25'}`}>
      {item.display_image_url && <img src={item.display_image_url} alt={item.name} loading="lazy" className="h-44 w-full object-cover" />}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {categoryName && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{categoryName}</p>}
            <h3 className="mt-1 font-serif text-[22px] leading-snug text-[#1F3A5F]">{item.name}</h3>
          </div>
          {item.is_signature && (
            <span className="mt-1 shrink-0 rounded-full bg-[#FF2147]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#FF2147]">Signature</span>
          )}
        </div>
        {item.description && <p className="mt-2 flex-1 text-[14.5px] leading-7 text-slate-500">{item.description}</p>}
        {(item.dietary_tags || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.dietary_tags.map((tag) => (
              <span key={tag} title={tag} className="rounded-sm border border-[#1F3A5F]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-slate-500">{TAG_ABBR[tag] || tag}</span>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="font-serif text-2xl text-[#1F3A5F]">{formatMoney(item.price)}</span>
          <QuantityControl quantity={quantity} onChange={onChange} name={item.name} />
        </div>
      </div>
    </article>
  )
}

function BasketPanel({ lines, count, subtotal, onChange, onClear, onCheckout, signedIn }) {
  return (
    <div id="basket" className="rounded-2xl bg-white p-6 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[#1F3A5F]">
          <Icon name="bag" size={20} />
          <h2 className="font-serif text-2xl">Your order</h2>
        </div>
        {count > 0 && (
          <button type="button" onClick={onClear} className="text-xs font-semibold text-slate-400 underline hover:text-[#FF2147]">Clear</button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-slate-500">
          Your basket is empty. Add a dish from the menu — or ask Alice to recommend something.
        </p>
      ) : (
        <>
          <div className="mt-5 max-h-[340px] space-y-4 overflow-y-auto pr-1">
            {lines.map((line) => (
              <div key={line.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5 text-[#1F3A5F]">{line.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{formatMoney(line.price)} each</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <QuantityControl size="sm" quantity={line.quantity} onChange={(q) => onChange(line.id, q)} name={line.name} />
                  <span className="text-xs font-semibold text-slate-600">{formatMoney(Number(line.price) * line.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-baseline justify-between border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-500">Subtotal · {count} item{count === 1 ? '' : 's'}</span>
            <span className="font-serif text-2xl text-[#1F3A5F]">{formatMoney(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">Tax and service are calculated at checkout.</p>
        </>
      )}

      <button
        type="button"
        onClick={onCheckout}
        disabled={!count}
        className="mt-5 w-full rounded-xl bg-[#FF2147] py-3.5 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {count ? `Checkout · ${formatMoney(subtotal)}` : 'Checkout'}
      </button>
      {!signedIn && count > 0 && (
        <p className="mt-3 text-center text-xs text-slate-400">You'll sign in at checkout — your basket is saved.</p>
      )}
    </div>
  )
}

export default function DeliveryHomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const cart = useDeliveryCart()

  const [restaurants, setRestaurants] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [diet, setDiet] = useState(null)
  const [intent, setIntent] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!location.state?.reordered) return
    const skipped = location.state.reorderSkipped || 0
    setNotice(
      skipped
        ? `Your previous order is back in your basket. ${skipped} dish${skipped === 1 ? ' is' : 'es are'} no longer on the menu and ${skipped === 1 ? 'was' : 'were'} left out.`
        : 'Your previous order is back in your basket.'
    )
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false
    api.get('/restaurants')
      .then((res) => {
        if (cancelled) return
        const list = (Array.isArray(res.data) ? res.data : []).filter((r) => r.is_active !== false)
        setRestaurants(list)
        const saved = getDeliveryCart().restaurantId
        setActiveId(list.some((r) => r.id === saved) ? saved : list[0]?.id || null)
      })
      .catch(() => { if (!cancelled) setError('We could not load the menu just now. Please try again in a moment.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!activeId) return undefined
    let cancelled = false
    setMenuLoading(true)
    api.get(`/restaurants/${activeId}/menu`)
      .then((res) => { if (!cancelled) setMenu(Array.isArray(res.data) ? res.data : []) })
      .catch(() => { if (!cancelled) setError('We could not load the menu just now. Please try again in a moment.') })
      .finally(() => { if (!cancelled) setMenuLoading(false) })
    return () => { cancelled = true }
  }, [activeId])

  const active = restaurants.find((r) => r.id === activeId) || null

  const categories = useMemo(
    () => menu
      .map((c) => ({ ...c, items: (c.items || []).filter((i) => i.is_available) }))
      .filter((c) => c.items.length > 0),
    [menu]
  )

  const itemsById = useMemo(() => {
    const map = {}
    categories.forEach((c) => c.items.forEach((i) => { map[i.id] = i }))
    return map
  }, [categories])

  const availableDiets = useMemo(
    () => DIET_FILTERS.filter((d) => categories.some((c) => c.items.some((i) => (i.dietary_tags || []).includes(d)))),
    [categories]
  )

  const query = search.trim().toLowerCase()

  // A search looks across the whole menu; otherwise the chosen tab applies.
  const sections = useMemo(() => {
    const pool = query || category === 'all' ? categories : categories.filter((c) => c.id === category)
    return pool
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => {
          if (diet && !(i.dietary_tags || []).includes(diet)) return false
          if (!query) return true
          const haystack = `${i.name} ${i.description || ''} ${c.name} ${(i.dietary_tags || []).join(' ')}`.toLowerCase()
          return haystack.includes(query)
        }),
      }))
      .filter((c) => c.items.length > 0)
  }, [categories, category, diet, query])

  const cartItems = cart.restaurantId === activeId ? cart.items : {}
  const lines = Object.entries(cartItems)
    .map(([id, quantity]) => (itemsById[id] ? { ...itemsById[id], quantity } : null))
    .filter(Boolean)
  const count = lines.reduce((n, l) => n + l.quantity, 0)
  const subtotal = lines.reduce((sum, l) => sum + Number(l.price) * l.quantity, 0)
  const otherKitchenBasket = cart.restaurantId && cart.restaurantId !== activeId && cartCount(cart) > 0

  function changeQty(itemId, quantity) {
    setItemQuantity(activeId, itemId, quantity)
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function askAlice() {
    setIntent('delivery')
    window.setTimeout(() => scrollTo('dining-concierge'), 80)
  }

  function goCheckout() {
    navigate('/delivery/checkout')
  }

  return (
    <AppLayout>
      <div className="relative left-1/2 -ml-[50vw] w-screen -mt-6 lg:-mt-8">

        {/* Shorter than the hotel and restaurant heroes on purpose: on a page
            whose job is ordering, the menu should begin within one scroll. */}
        <section className="relative h-[72vh] min-h-[560px] bg-[#0E2036]">
          <CinematicHero images={HERO_IMAGES} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/75" />
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">Delivery{active ? ` · ${active.name}` : ''}</p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[1.04] text-white sm:text-7xl">Good food, delivered beautifully.</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg">
              The same kitchen as our dining room, cooked to order and brought to your door.
            </p>

            <div className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl">
              <span className="pl-3 text-slate-400"><Icon name="search" /></span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') scrollTo('the-menu') }}
                placeholder="Search dishes — biryani, vegan, dessert…"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-[#1F3A5F] outline-none placeholder:text-slate-400"
              />
              <button type="button" onClick={() => scrollTo('the-menu')} className="rounded-xl bg-[#FF2147] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#dc1539]">Search</button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-[0.16em] text-white/75">
              <button type="button" onClick={askAlice} className="flex items-center gap-2 underline-offset-4 hover:text-white hover:underline">
                <Icon name="sparkle" size={15} /> Ask Alice to choose
              </button>
              {user?.role === 'CUSTOMER' && (
                <Link to="/delivery/orders" className="underline-offset-4 hover:text-white hover:underline">Track an order</Link>
              )}
            </div>
            <span className="absolute bottom-7 animate-bounce text-white/50"><Icon name="arrowDown" size={20} /></span>
          </div>
        </section>

        {restaurants.length > 1 && (
          <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className={`mx-auto ${CONTENT_MAX_W} flex flex-wrap justify-center gap-2`}>
              {restaurants.map((r) => (
                <button key={r.id} type="button" onClick={() => { setActiveId(r.id); setCategory('all') }} className={`rounded-full px-5 py-2 text-sm font-bold transition ${r.id === activeId ? 'bg-[#1F3A5F] text-white' : 'text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
                  {r.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <section id="the-menu" className="scroll-mt-[72px] bg-[#F5F2ED]">
          <div className="sticky top-[72px] z-30 border-b border-[#1F3A5F]/10 bg-[#F5F2ED]/95 backdrop-blur">
            <div className={`mx-auto ${CONTENT_MAX_W} flex flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8`}>
              <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:pb-0">
                {[{ id: 'all', name: 'All' }, ...categories].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCategory(c.id); setSearch('') }}
                    className={`relative shrink-0 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] transition ${category === c.id && !query ? 'text-[#1F3A5F]' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {c.name}
                    {category === c.id && !query && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#FF2147]" />}
                  </button>
                ))}
              </div>
              {availableDiets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {availableDiets.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiet(diet === d ? null : d)}
                      className={`rounded-full px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition ${diet === d ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-500 ring-1 ring-[#1F3A5F]/15 hover:bg-slate-50'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`mx-auto ${CONTENT_MAX_W} px-4 py-12 sm:px-6 lg:px-8`}>
            {notice && (
              <div className="mb-8 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice('')} className="shrink-0 font-bold" aria-label="Dismiss">×</button>
              </div>
            )}
            {otherKitchenBasket && (
              <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                Your basket has dishes from another restaurant. Adding a dish here will start a new basket.
              </div>
            )}
            {error && <div className="mb-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}
            {query && (
              <p className="mb-6 text-sm text-slate-500">
                {sections.reduce((n, s) => n + s.items.length, 0)} result(s) for “{search.trim()}” ·{' '}
                <button type="button" onClick={() => setSearch('')} className="font-semibold text-[#1F3A5F] underline">clear search</button>
              </p>
            )}

            <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
              <div>
                {(loading || menuLoading) && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-60 animate-pulse rounded-2xl bg-white/70" />)}
                  </div>
                )}

                {!loading && !menuLoading && sections.length === 0 && (
                  <div className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-slate-200/80">
                    <p className="font-serif text-2xl text-[#1F3A5F]">Nothing matches that just now.</p>
                    <p className="mt-2 text-sm text-slate-500">Try another search or filter — or let Alice suggest something.</p>
                    <button type="button" onClick={askAlice} className="mt-6 rounded-xl bg-[#1F3A5F] px-6 py-3 text-sm font-bold text-white hover:bg-[#162f4d]">Ask Alice</button>
                  </div>
                )}

                {!loading && !menuLoading && sections.map((section) => (
                  <div key={section.id} className="mb-14 last:mb-0">
                    <div className="mb-6 flex items-center gap-4">
                      <h2 className="font-serif text-3xl text-[#1F3A5F]">{section.name}</h2>
                      <span className="h-px flex-1 bg-[#1F3A5F]/15" />
                      <span className="text-xs font-semibold text-slate-400">{section.items.length} dish{section.items.length === 1 ? '' : 'es'}</span>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {section.items.map((item) => (
                        <DishCard
                          key={item.id}
                          item={item}
                          categoryName={query ? section.name : null}
                          quantity={cartItems[item.id] || 0}
                          onChange={(q) => changeQty(item.id, q)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <aside className="lg:sticky lg:top-[160px] lg:self-start">
                <BasketPanel
                  lines={lines}
                  count={count}
                  subtotal={subtotal}
                  onChange={changeQty}
                  onClear={clearDeliveryCart}
                  onCheckout={goCheckout}
                  signedIn={!!user}
                />
              </aside>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W}`}>
            <div className="max-w-2xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">How it works</p>
              <h2 className="mt-3 font-serif text-5xl leading-tight text-[#1F3A5F] sm:text-6xl">From our kitchen to your door.</h2>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                { icon: 'bag', step: '01', title: 'Choose and pay', copy: 'Build your order from the live menu and pay securely at checkout — your total is confirmed before you pay.' },
                { icon: 'chef', step: '02', title: 'Cooked to order', copy: 'The kitchen accepts your order and prepares it fresh, exactly as it would be served in the dining room.' },
                { icon: 'scooter', step: '03', title: 'Track to your door', copy: 'Follow every step — from the kitchen to your rider — on a live tracker that updates itself.' },
              ].map((s) => (
                <div key={s.step} className="rounded-2xl border border-slate-200 p-8">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2147]/10 text-[#FF2147]"><Icon name={s.icon} size={22} /></span>
                    <span className="font-serif text-4xl text-[#1F3A5F]/15">{s.step}</span>
                  </div>
                  <h3 className="mt-6 font-serif text-2xl text-[#1F3A5F]">{s.title}</h3>
                  <p className="mt-3 text-base leading-7 text-slate-600">{s.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="dining-concierge" className="scroll-mt-[72px] bg-[#F5F2ED] px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-10 text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">Not sure what to order?</p>
              <h2 className="mt-3 font-serif text-4xl text-[#1F3A5F] sm:text-5xl">Let Alice choose with you.</h2>
            </div>
            {active && (
              <DiningConcierge
                restaurantId={active.id}
                restaurantName={active.name}
                menu={menu}
                intent={intent}
                onIntentHandled={() => setIntent(null)}
              />
            )}
          </div>
        </section>
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[140] border-t border-slate-200 bg-white/95 px-4 py-3 pr-24 backdrop-blur lg:hidden">
          <button type="button" onClick={goCheckout} className="flex w-full items-center justify-between rounded-xl bg-[#FF2147] px-5 py-3 text-sm font-bold text-white">
            <span>{count} item{count === 1 ? '' : 's'} · {formatMoney(subtotal)}</span>
            <span>Checkout →</span>
          </button>
        </div>
      )}
    </AppLayout>
  )
}