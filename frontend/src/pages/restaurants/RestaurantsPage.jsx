import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import DiningConcierge from '../../components/restaurants/DiningConcierge'
import ReserveTablePanel from '../../components/restaurants/ReserveTablePanel'
import PromoBand from '../../components/marketing/PromoBand'

const CONTENT_MAX_W = 'max-w-[1280px]'

// Licence-verified imagery (Pexels + Unsplash, both free for commercial
// use). Led by plated fine-dining photography, the way luxury hotel
// restaurants present themselves.
const IMG_STEAK_WINE = 'https://images.pexels.com/photos/8697542/pexels-photo-8697542.jpeg?auto=compress&cs=tinysrgb&w=2400'
const IMG_DUCK = 'https://images.pexels.com/photos/3791089/pexels-photo-3791089.jpeg?auto=compress&cs=tinysrgb&w=2400'
const IMG_BEEF = 'https://images.pexels.com/photos/299348/pexels-photo-299348.jpeg?auto=compress&cs=tinysrgb&w=2400'
const IMG_CANDLE_TABLE = 'https://images.unsplash.com/photo-1695641738244-25e5355e9a42?fm=jpg&q=80&w=2600&auto=format&fit=crop'
const IMG_CANDLES = 'https://images.unsplash.com/photo-1606659894125-40824878b6ce?fm=jpg&q=80&w=2600&auto=format&fit=crop'
const IMG_DISH = 'https://images.unsplash.com/photo-1660380775592-5647075c8ea0?fm=jpg&q=80&w=2400&auto=format&fit=crop'
const IMG_BAR = 'https://images.unsplash.com/photo-1760982192590-de2b005bb4d5?fm=jpg&q=80&w=2400&auto=format&fit=crop'
const IMG_COCKTAIL = 'https://images.unsplash.com/photo-1750124933194-e021f47b5f8b?fm=jpg&q=80&w=1800&auto=format&fit=crop'

// Your own interior photography, served from frontend/public/images/restaurant/.
const IMG_ROOM_CHANDELIER = '/images/restaurant/dining-room-chandelier.jpg'
const IMG_ROOM_LONG_TABLE = '/images/restaurant/dining-room-long-table.jpg'
const IMG_ROOM_HALL = '/images/restaurant/restaurant-hall.avif'
const IMG_TERRACE = '/images/restaurant/terrace-sunset.jpg'

// The hero is deliberately curated rather than pulled from the database,
// so it always opens on the strongest images in a considered order —
// alternating interiors with plated food. The terrace shot sits mid-cycle
// because it's a low-resolution preview and softer at full width.
const HERO_IMAGES = [
  IMG_ROOM_CHANDELIER,
  IMG_STEAK_WINE,
  IMG_ROOM_LONG_TABLE,
  IMG_CANDLE_TABLE,
  IMG_TERRACE,
  IMG_DUCK,
  IMG_ROOM_HALL,
  IMG_COCKTAIL,
]

const MOTIONS = ['heroZoomIn', 'heroPanLeft', 'heroPanRight', 'heroZoomOut']

const TAG_ABBR = {
  'Gluten-Free': 'GF',
  'Dairy-Free': 'DF',
  Vegetarian: 'VG',
  Vegan: 'V',
  'Contains Nuts': 'N',
  Spicy: '🌶',
}

const CATEGORY_NOTES = {
  Starters: 'Small plates to open the table — meant for sharing, or not.',
  Mains: 'Cooked to order. Please allow a little time for the charcoal dishes.',
  Desserts: 'Made in-house each morning.',
  Drinks: 'Ask your server for this week’s pour.',
  'Happy Hour': 'Daily, 5pm – 7pm.',
}

function Icon({ name, size = 18 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    pin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
    phone: (<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z" />),
    table: (<><path d="M3 10h18M5 10v10M19 10v10M4 6h16l1 4H3Z" /></>),
    dish: (<><path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 6v4M12 4h.01" /></>),
    scooter: (<><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 18h6M15 18V7a2 2 0 0 1 2-2h2M6 15V9h5l3 6" /></>),
    arrowDown: (<path d="M12 5v14M19 12l-7 7-7-7" />),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function CinematicHero({ images, alt }) {
  // An image that fails to load leaves a transparent frame, so the dark
  // section background shows through and the hero looks broken. Any image
  // that fails is dropped from the rotation and named in the console, so a
  // missing file can never stall the sequence.
  const [failed, setFailed] = useState(() => new Set())
  const [index, setIndex] = useState(0)
  const CYCLE_MS = 6000

  const safe = useMemo(() => images.filter((src) => src && !failed.has(src)), [images, failed])

  function markFailed(src) {
    console.warn('[Hero] image failed to load, skipping:', src)
    setFailed((prev) => new Set(prev).add(src))
  }

  useEffect(() => {
    if (safe.length <= 1) return undefined
    const t = window.setInterval(() => setIndex((c) => (c + 1) % safe.length), CYCLE_MS)
    return () => window.clearInterval(t)
  }, [safe.length])

  useEffect(() => {
    if (index >= safe.length) setIndex(0)
  }, [safe.length, index])

  if (!safe.length) return null

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes heroZoomIn  { from { transform: scale(1)    translate3d(0,0,0); }     to { transform: scale(1.14) translate3d(0,0,0); } }
        @keyframes heroZoomOut { from { transform: scale(1.14) translate3d(0,0,0); }     to { transform: scale(1)    translate3d(0,0,0); } }
        @keyframes heroPanLeft { from { transform: scale(1.14) translate3d(3.5%,0,0); }  to { transform: scale(1.14) translate3d(-3.5%,0,0); } }
        @keyframes heroPanRight{ from { transform: scale(1.14) translate3d(-3.5%,0,0); } to { transform: scale(1.14) translate3d(3.5%,0,0); } }
      `}</style>
      {safe.map((src, i) => (
        // Stable key. The old key changed every cycle, so React destroyed
        // and rebuilt the <img>, forcing a re-download and the dark flash.
        // The animation still restarts, because `animation` flips between
        // 'none' and the animation name as the index moves.
        <img
          key={src}
          src={src}
          alt={alt}
          onError={() => markFailed(src)}
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

function MenuBoard({ menu, loading, dietFilter, setDietFilter }) {
  const [activeCategory, setActiveCategory] = useState(null)

  // Only dishes the kitchen currently offers are shown on the public menu.
  const categories = useMemo(
    () => menu
      .map((c) => ({ ...c, items: (c.items || []).filter((i) => i.is_available) }))
      .filter((c) => c.items.length > 0),
    [menu]
  )

  useEffect(() => {
    if (categories.length && !categories.some((c) => c.id === activeCategory)) setActiveCategory(categories[0].id)
  }, [categories, activeCategory])

  if (loading) {
    return (
      <div className="mx-auto mt-12 max-w-4xl space-y-4">
        {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 animate-pulse rounded bg-white/60" />)}
      </div>
    )
  }

  if (!categories.length) {
    return <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-[#1F3A5F]/10 bg-white px-6 py-16 text-center text-base text-slate-500">The menu is being updated — please check back shortly.</div>
  }

  const active = categories.find((c) => c.id === activeCategory) || categories[0]
  const items = dietFilter ? active.items.filter((i) => (i.dietary_tags || []).includes(dietFilter)) : active.items

  const availableTags = [...new Set(categories.flatMap((c) => c.items.flatMap((i) => i.dietary_tags || [])))]
    .filter((t) => ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free'].includes(t))
    .sort()

  return (
    <div className="mt-14">
      <div className="flex flex-wrap justify-center gap-x-1 gap-y-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { setActiveCategory(c.id); setDietFilter(null) }}
            className={`relative px-5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] transition ${c.id === active.id ? 'text-[#1F3A5F]' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {c.name}
            {c.id === active.id && <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#FF2147]" />}
          </button>
        ))}
      </div>

      <div className="relative mx-auto mt-10 max-w-5xl">
        <div className="absolute inset-0 -rotate-[0.35deg] rounded-sm bg-white/50 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)]" />
        {/* Eight dishes per section plus a fixed minimum height, so switching
            tabs never changes the page height. */}
        <div className="relative flex min-h-[860px] flex-col rounded-sm bg-[#FCFBF7] px-6 py-14 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.28)] ring-1 ring-[#1F3A5F]/10 sm:px-14 lg:px-20">
          <div className="pointer-events-none absolute inset-4 rounded-sm border border-[#1F3A5F]/12" />

          <div className="relative text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#FF2147]">Bill of fare</p>
            <h3 className="mt-4 font-serif text-5xl tracking-tight text-[#1F3A5F] sm:text-6xl">{active.name}</h3>
            <div className="mx-auto mt-5 flex max-w-xs items-center gap-3">
              <span className="h-px flex-1 bg-[#1F3A5F]/20" />
              <span className="h-1.5 w-1.5 rotate-45 bg-[#FF2147]" />
              <span className="h-px flex-1 bg-[#1F3A5F]/20" />
            </div>
            {CATEGORY_NOTES[active.name] && (
              <p className="mx-auto mt-5 max-w-md font-serif text-base italic leading-7 text-slate-500">{CATEGORY_NOTES[active.name]}</p>
            )}
          </div>

          {availableTags.length > 0 && (
            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDietFilter(null)}
                className={`rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition ${!dietFilter ? 'bg-[#1F3A5F] text-white' : 'text-slate-500 ring-1 ring-[#1F3A5F]/15 hover:bg-white'}`}
              >
                All
              </button>
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setDietFilter(dietFilter === tag ? null : tag)}
                  className={`rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] transition ${dietFilter === tag ? 'bg-[#1F3A5F] text-white' : 'text-slate-500 ring-1 ring-[#1F3A5F]/15 hover:bg-white'}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {items.length === 0 ? (
            <p className="relative mt-14 text-center font-serif text-lg italic text-slate-500">
              Nothing in {active.name} matches that filter — try another section.
            </p>
          ) : (
            <div className="relative mt-14 grid gap-x-16 gap-y-11 md:grid-cols-2">
              {items.map((item) => (
                <article key={item.id}>
                  <div className="flex items-baseline gap-2">
                    <h4 className="font-serif text-[22px] leading-snug text-[#1F3A5F]">{item.name}</h4>
                    {item.is_signature && (
                      <span className="shrink-0 rounded-full bg-[#FF2147]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#FF2147]">Signature</span>
                    )}
                    <span className="mx-1 h-px flex-1 translate-y-[-4px] border-b border-dotted border-[#1F3A5F]/30" />
                    <span className="shrink-0 font-serif text-[22px] text-[#1F3A5F]">{Number(item.price).toFixed(2)}</span>
                  </div>
                  {item.description && <p className="mt-2 max-w-md text-[14.5px] leading-7 text-slate-500">{item.description}</p>}
                  {(item.dietary_tags || []).length > 0 && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {item.dietary_tags.map((tag) => (
                        <span key={tag} title={tag} className="rounded-sm border border-[#1F3A5F]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-[0.08em] text-slate-500">
                          {TAG_ABBR[tag] || tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          <div className="relative mt-auto border-t border-[#1F3A5F]/10 pt-8 text-center">
            <p className="text-[11px] leading-6 tracking-wide text-slate-400">
              GF Gluten-Free &nbsp;·&nbsp; DF Dairy-Free &nbsp;·&nbsp; VG Vegetarian &nbsp;·&nbsp; V Vegan &nbsp;·&nbsp; N Contains Nuts &nbsp;·&nbsp; 🌶 Spicy
            </p>
            <p className="mt-2 font-serif text-sm italic text-slate-400">
              Please tell your server about any allergy — we cook to order and can adapt most dishes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RestaurantsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [restaurants, setRestaurants] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [menu, setMenu] = useState([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [dietFilter, setDietFilter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [intent, setIntent] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get('/restaurants')
      .then((res) => {
        if (cancelled) return
        const list = Array.isArray(res.data) ? res.data : []
        setRestaurants(list)
        if (list.length) setActiveId(list[0].id)
      })
      .catch(() => { if (!cancelled) setError('Could not load the restaurant right now.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!activeId) return undefined
    let cancelled = false
    setMenuLoading(true)
    api.get(`/restaurants/${activeId}/menu`)
      .then((res) => { if (!cancelled) setMenu(Array.isArray(res.data) ? res.data : []) })
      .catch(() => { if (!cancelled) setMenu([]) })
      .finally(() => { if (!cancelled) setMenuLoading(false) })
    return () => { cancelled = true }
  }, [activeId])

  // Lets any other page deep-link straight into a conversation, e.g.
  // /restaurants?intent=reserve or ?intent=delivery.
  useEffect(() => {
    const q = searchParams.get('intent')
    if (!q || !activeId) return
    startIntent(q)
    const next = new URLSearchParams(searchParams)
    next.delete('intent')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeId])

  const active = restaurants.find((r) => r.id === activeId) || restaurants[0] || null

  const availableItems = useMemo(() => menu.flatMap((c) => (c.items || []).filter((i) => i.is_available)), [menu])
  const sectionCount = useMemo(() => menu.filter((c) => (c.items || []).some((i) => i.is_available)).length, [menu])
  const lowestPrice = useMemo(() => {
    const prices = availableItems.map((i) => Number(i.price)).filter((n) => n > 0)
    return prices.length ? Math.min(...prices) : null
  }, [availableItems])

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Alice is a shortcut for guests who want one — never the only route.
  // Every action here works without her.
  function startIntent(which) {
    setIntent(which)
    window.setTimeout(() => scrollTo('dining-concierge'), 80)
  }

  return (
    <AppLayout>
      <div className="relative left-1/2 -ml-[50vw] w-screen -mt-6 lg:-mt-8">

        <section className="relative h-[72vh] min-h-[580px] bg-[#0E2036]">
          <CinematicHero images={HERO_IMAGES} alt={active?.name || 'Restaurant'} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/75" />
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-white/70">Dining</p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[1.04] text-white sm:text-7xl">{active?.name || 'Dine with us'}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/75 sm:text-lg">A room worth lingering in, a menu worth returning for.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => scrollTo('reserve-a-table')} className="rounded-xl bg-[#FF2147] px-8 py-3.5 text-sm font-bold uppercase tracking-[0.06em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#dc1539]">
                Reserve a table
              </button>
              <button type="button" onClick={() => navigate('/delivery')} className="rounded-xl bg-white px-8 py-3.5 text-sm font-bold uppercase tracking-[0.06em] text-[#1F3A5F] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#F0EBE3]">
                Order delivery
              </button>
            </div>
            <button type="button" onClick={() => scrollTo('the-menu')} className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/70 underline underline-offset-4 hover:text-white">
              View the menu
            </button>
            <span className="absolute bottom-7 animate-bounce text-white/50"><Icon name="arrowDown" size={20} /></span>
          </div>
        </section>

        {restaurants.length > 1 && (
          <section className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className={`mx-auto ${CONTENT_MAX_W} flex flex-wrap justify-center gap-2`}>
              {restaurants.map((r) => (
                <button key={r.id} type="button" onClick={() => setActiveId(r.id)} className={`rounded-full px-5 py-2 text-sm font-bold transition ${r.id === activeId ? 'bg-[#1F3A5F] text-white' : 'text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
                  {r.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W} grid gap-16 lg:grid-cols-[1fr_1fr] lg:items-center`}>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">The restaurant</p>
              <h2 className="mt-3 font-serif text-5xl leading-[1.08] text-[#1F3A5F] sm:text-6xl">A table you won't<br />want to leave.</h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                {active?.description
                  || 'Warm light, unhurried service, and a kitchen that treats an ordinary Tuesday with the same care as a celebration.'}
              </p>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Reserve a table in a few taps, order to your room during your stay, or have it delivered to your door — all from the same account.
              </p>

              {!menuLoading && availableItems.length > 0 && (
                <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-8">
                  <div>
                    <p className="font-serif text-4xl text-[#1F3A5F]">{sectionCount}</p>
                    <p className="mt-1 text-sm text-slate-500">Menu sections</p>
                  </div>
                  <div>
                    <p className="font-serif text-4xl text-[#1F3A5F]">{availableItems.length}</p>
                    <p className="mt-1 text-sm text-slate-500">Dishes &amp; drinks</p>
                  </div>
                  {lowestPrice != null && (
                    <div>
                      <p className="font-serif text-4xl text-[#1F3A5F]">${lowestPrice.toFixed(0)}</p>
                      <p className="mt-1 text-sm text-slate-500">Starting from</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 grid-rows-6 gap-4 lg:h-[560px]">
              <img src={IMG_CANDLE_TABLE} alt="" className="col-span-3 row-span-4 h-full w-full rounded-2xl object-cover" />
              <img src={IMG_DUCK} alt="" className="col-span-2 row-span-3 mt-10 h-full w-full rounded-2xl object-cover" />
              <img src={IMG_STEAK_WINE} alt="" className="col-span-3 row-span-2 h-full w-full rounded-2xl object-cover" />
              <img src={IMG_DISH} alt="" className="col-span-2 row-span-3 h-full w-full rounded-2xl object-cover" />
            </div>
          </div>
        </section>

        <section id="the-menu" className="bg-[#F0EBE3] px-4 py-24 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W}`}>
            <div className="text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">Our menu</p>
              <h2 className="mt-3 font-serif text-5xl text-[#1F3A5F] sm:text-6xl">What's on today</h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
                Everything below is live from the kitchen's own list — if it's here, it's on tonight.
              </p>
            </div>
            <MenuBoard menu={menu} loading={menuLoading} dietFilter={dietFilter} setDietFilter={setDietFilter} />
          </div>
        </section>

        <PromoBand kind="restaurant" onCta={() => scrollTo('reserve-a-table')} />

        <section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W}`}>
            <div className="max-w-2xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">However you like it</p>
              <h2 className="mt-3 font-serif text-5xl leading-tight text-[#1F3A5F] sm:text-6xl">Three ways to eat with us.</h2>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                { icon: 'table', eyebrow: 'Reserve', title: 'Book a table', copy: 'Pick your date, time and party size — we check the live floor plan, so what you see is genuinely free.', cta: 'Book a table', action: () => scrollTo('reserve-a-table') },
                { icon: 'dish', eyebrow: 'Dine in', title: 'Order at the table', copy: 'Browse the full menu before you arrive, and order from your seat without waiting to catch a waiter.', cta: 'See the menu', action: () => scrollTo('the-menu') },
                { icon: 'scooter', eyebrow: 'Deliver', title: 'Bring it to me', copy: "The same kitchen, brought to your door — or straight to your room if you're staying with us.", cta: 'Order delivery', action: () => navigate('/delivery') },
              ].map((card) => (
                <div key={card.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 transition hover:border-[#1F3A5F]/25 hover:shadow-lg">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2147]/10 text-[#FF2147]"><Icon name={card.icon} size={22} /></span>
                  <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[#FF2147]">{card.eyebrow}</p>
                  <h3 className="mt-2 font-serif text-3xl text-[#1F3A5F]">{card.title}</h3>
                  <p className="mt-3 flex-1 text-base leading-7 text-slate-600">{card.copy}</p>
                  <button type="button" onClick={card.action} className="mt-6 self-start text-sm font-bold text-[#1F3A5F] underline underline-offset-4 hover:text-[#FF2147]">{card.cta} →</button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The booking form comes BEFORE the concierge, deliberately: a guest
            who simply wants a table should never have to scroll past a
            conversation to find one. */}
        {/* Full-width warm band with the card in white, the same treatment as
            the menu section — so the booking area reads as a place in the
            restaurant rather than a form floating on the page. */}
        <section id="reserve-a-table" className="scroll-mt-[76px] bg-[#F0EBE3] px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            {active && (
              <ReserveTablePanel
                restaurantId={active.id}
                restaurantName={active.name}
                onAskAlice={() => startIntent('reserve')}
              />
            )}
          </div>
        </section>

        <section id="dining-concierge" className="scroll-mt-[76px] bg-[#F5F2ED] px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1100px]">
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

        <section className="relative overflow-hidden bg-[#101F31] px-4 py-28 sm:px-6 lg:px-8">
          <img src={IMG_BAR} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#101F31] via-[#101F31]/85 to-[#101F31]/40" />
          <div className={`relative mx-auto ${CONTENT_MAX_W} grid gap-12 lg:grid-cols-2 lg:items-center`}>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">The bar</p>
              <h2 className="mt-3 font-serif text-5xl leading-tight text-white sm:text-6xl">Something to start the evening.</h2>
              <p className="mt-6 text-lg leading-8 text-white/70">
                Pull up a stool before dinner or settle in long after it. Our bar keeps its own hours and its own
                rhythm — a good place to wait for a table, and an even better one to end up at instead.
              </p>
            </div>
            <img src={IMG_COCKTAIL} alt="Craft cocktail" className="h-[380px] w-full rounded-2xl object-cover" />
          </div>
        </section>

        <section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W} grid gap-12 lg:grid-cols-2 lg:items-center`}>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">Find us</p>
              <h2 className="mt-3 font-serif text-5xl leading-tight text-[#1F3A5F] sm:text-6xl">Inside the hotel.</h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                You'll find us on the ground floor — no need to step outside, and no need to book a taxi to get a good meal.
              </p>
              {active?.address && (
                <p className="mt-8 flex items-start gap-3 text-base leading-7 text-[#1F3A5F]">
                  <span className="mt-1 shrink-0 text-[#FF2147]"><Icon name="pin" size={18} /></span>
                  <span><span className="font-bold">{active.name}</span><br />{active.address}</span>
                </p>
              )}
              {active?.phone && (
                <p className="mt-3 flex items-center gap-3 text-base text-slate-600">
                  <span className="shrink-0 text-[#FF2147]"><Icon name="phone" size={18} /></span>
                  {active.phone}
                </p>
              )}
            </div>
            <img src={IMG_CANDLES} alt="" className="h-[420px] w-full rounded-2xl object-cover" />
          </div>
        </section>

        {error && (
          <section className="bg-white px-4 pb-16 sm:px-6 lg:px-8">
            <div className={`mx-auto ${CONTENT_MAX_W} rounded-2xl border border-red-200 bg-red-50 p-6 text-base text-red-700`}>{error}</div>
          </section>
        )}

        {!loading && !restaurants.length && (
          <section className="bg-white px-4 py-24 sm:px-6 lg:px-8">
            <div className={`mx-auto ${CONTENT_MAX_W} rounded-2xl border border-slate-200 bg-slate-50 p-16 text-center text-base text-slate-500`}>No restaurants are available yet.</div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}