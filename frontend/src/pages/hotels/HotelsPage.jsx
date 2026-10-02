import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import PromoBand from '../../components/marketing/PromoBand'

const CONTENT_MAX_W = 'max-w-[1280px]'

// Verified free-licence imagery, deliberately NOT shared with the hotel
// detail page (which owns the lobby / corridor / pool set).
const HERO_EXTRAS = [
  'https://images.unsplash.com/photo-1651830949817-7642bdf5397e?fm=jpg&q=80&w=2600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1739304150315-26a8676d01ef?fm=jpg&q=80&w=2600&auto=format&fit=crop',
]
const DHAKA_NIGHT = 'https://images.unsplash.com/photo-1637621313805-be854a7e4170?fm=jpg&q=80&w=2400&auto=format&fit=crop'
const DHAKA_STREET = 'https://images.unsplash.com/photo-1664101940744-f424a9ebfe73?fm=jpg&q=80&w=2000&auto=format&fit=crop'

function Icon({ name, size = 18 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    calendar: (<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
    users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
    check: (<path d="M20 6 9 17l-5-5" />),
    mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
    pin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
    phone: (<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z" />),
    compass: (<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5 5.5-2Z" /></>),
    bed: (<><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M2 16h20M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>),
    dish: (<><path d="M3 17h18M5 17a7 7 0 0 1 14 0M12 6v4M12 4h.01" /></>),
    scooter: (<><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 18h6M15 18V7a2 2 0 0 1 2-2h2M6 15V9h5l3 6" /></>),
    arrowDown: (<path d="M12 5v14M19 12l-7 7-7-7" />),
    arrow: (<path d="M5 12h14m-6-6 6 6-6 6" />),
  }
  return <svg {...common}>{paths[name]}</svg>
}

const MOTIONS = ['heroZoomIn', 'heroPanLeft', 'heroPanRight', 'heroZoomOut']

function CinematicHero({ images, alt }) {
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
        // and rebuilt the <img>, forcing the browser to re-download it —
        // which is what made the hero flash the dark background. The
        // animation still restarts correctly, because `animation` flips
        // between 'none' and the animation name as the index moves.
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

function BookingBar({ onSearch }) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const [checkIn, setCheckIn] = useState(fmt(today))
  const [checkOut, setCheckOut] = useState(fmt(tomorrow))
  const [guests, setGuests] = useState(2)

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSearch({ checkIn, checkOut, guests }) }}
      className="grid grid-cols-1 divide-y divide-slate-200 rounded-2xl bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.35)] ring-1 ring-black/5 md:grid-cols-[1fr_1fr_.85fr_auto] md:divide-x md:divide-y-0"
    >
      <label className="flex min-h-[74px] flex-col justify-center px-6 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Arrive</span>
        <span className="mt-1 flex items-center gap-2 text-navy">
          <Icon name="calendar" size={16} />
          <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full bg-transparent text-base font-semibold text-navy outline-none" />
        </span>
      </label>
      <label className="flex min-h-[74px] flex-col justify-center px-6 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Depart</span>
        <span className="mt-1 flex items-center gap-2 text-navy">
          <Icon name="calendar" size={16} />
          <input type="date" value={checkOut} min={checkIn} onChange={(e) => setCheckOut(e.target.value)} className="w-full bg-transparent text-base font-semibold text-navy outline-none" />
        </span>
      </label>
      <label className="flex min-h-[74px] flex-col justify-center px-6 py-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Guests</span>
        <span className="mt-1 flex items-center gap-2 text-navy">
          <Icon name="users" size={16} />
          <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full bg-transparent text-base font-semibold text-navy outline-none">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((v) => <option key={v} value={v}>{v} {v === 1 ? 'Guest' : 'Guests'}</option>)}
          </select>
        </span>
      </label>
      <button type="submit" className="flex min-h-[74px] items-center justify-center gap-2 rounded-b-2xl bg-[#FF2147] px-9 text-base font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#dc1539] md:rounded-b-none md:rounded-r-2xl">
        <Icon name="search" size={17} />
        Check availability
      </button>
    </form>
  )
}

function RoomsCarousel({ roomTypes, onSelect }) {
  const [index, setIndex] = useState(0)
  const count = roomTypes.length
  const AUTO_MS = 4000

  useEffect(() => {
    if (count <= 1) return undefined
    const t = window.setInterval(() => setIndex((c) => (c + 1) % count), AUTO_MS)
    return () => window.clearInterval(t)
  }, [count])

  if (!count) return null

  const go = (d) => setIndex((c) => (c + d + count) % count)
  const active = roomTypes[index]
  const prev = count > 1 ? roomTypes[(index - 1 + count) % count] : null
  const next = count > 1 ? roomTypes[(index + 1) % count] : null

  const Side = ({ rt, onClick, label }) => (
    <button type="button" onClick={onClick} aria-label={label} className="hidden shrink-0 overflow-hidden rounded-2xl opacity-45 transition-opacity duration-500 hover:opacity-75 lg:block">
      <div className="h-[300px] w-[300px] xl:h-[340px] xl:w-[360px]">
        {rt.primary_image_url
          ? <img src={rt.primary_image_url} alt={rt.name} className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-400">No image</div>}
      </div>
    </button>
  )

  return (
    <div className="relative">
      <div className="flex items-center justify-center gap-5 px-4 xl:gap-8">
        {count > 1 && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous room type" className="z-20 hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl text-navy shadow-lg transition hover:bg-slate-50 sm:flex">‹</button>
        )}
        {prev && <Side rt={prev} onClick={() => go(-1)} label="Previous room type" />}

        <button type="button" onClick={() => onSelect(active)} className="relative shrink-0 overflow-hidden rounded-2xl shadow-2xl">
          <div className="h-[420px] w-[86vw] max-w-[760px] sm:h-[520px]">
            {active.primary_image_url
              ? <img src={active.primary_image_url} alt={active.name} className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center bg-slate-100 text-slate-400">No image available</div>}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent p-7 pt-28 text-left">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/75">{active.name}</p>
            <p className="mt-1 text-3xl font-bold text-white">
              ${Number(active.base_price || 0).toFixed(2)} <span className="text-base font-normal text-white/70">/ night</span>
            </p>
            {active.view_type && (
              <p className="mt-1 text-sm text-white/70">
                {active.view_type}{active.bed_configuration ? ` · ${active.bed_configuration}` : ''}
              </p>
            )}
          </div>
        </button>

        {next && <Side rt={next} onClick={() => go(1)} label="Next room type" />}
        {count > 1 && (
          <button type="button" onClick={() => go(1)} aria-label="Next room type" className="z-20 hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl text-navy shadow-lg transition hover:bg-slate-50 sm:flex">›</button>
        )}
      </div>

      {count > 1 && (
        <div className="mt-7 flex justify-center gap-2">
          {roomTypes.map((rt, i) => (
            <button key={rt.id} type="button" onClick={() => setIndex(i)} aria-label={`Show ${rt.name}`} className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-[#FF2147]' : 'w-2 bg-slate-300'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function HotelsPage() {
  const navigate = useNavigate()

  const [hotels, setHotels] = useState([])
  const [roomTypesByHotel, setRoomTypesByHotel] = useState({})
  const [mediaByHotel, setMediaByHotel] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const hotelsRes = await api.get('/hotels')
        const list = Array.isArray(hotelsRes.data) ? hotelsRes.data : []
        if (cancelled) return
        setHotels(list)

        const results = await Promise.all(
          list.map(async (hotel) => {
            const [rtRes, mediaRes] = await Promise.allSettled([
              api.get(`/hotels/${hotel.id}/room-types`),
              api.get(`/media?entity_type=HOTEL&entity_id=${encodeURIComponent(hotel.id)}`),
            ])
            return {
              hotel,
              roomTypes: rtRes.status === 'fulfilled' && Array.isArray(rtRes.value.data) ? rtRes.value.data : [],
              media: mediaRes.status === 'fulfilled' && Array.isArray(mediaRes.value.data) ? mediaRes.value.data : [],
            }
          })
        )
        if (cancelled) return

        const roomMap = {}
        const mediaMap = {}
        results.forEach(({ hotel, roomTypes, media }) => {
          roomMap[hotel.id] = roomTypes
          mediaMap[hotel.id] = media
        })
        setRoomTypesByHotel(roomMap)
        setMediaByHotel(mediaMap)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.detail || 'Unable to load right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const hotel = hotels[0]
  const roomTypes = hotel ? (roomTypesByHotel[hotel.id] || []) : []

  const hotelImages = useMemo(() => {
    if (!hotel) return []
    return (mediaByHotel[hotel.id] || [])
      .filter((m) => m.is_active !== false && m.url)
      .sort((a, b) => {
        if (a.is_primary && !b.is_primary) return -1
        if (!a.is_primary && b.is_primary) return 1
        return Number(a.sort_order || 0) - Number(b.sort_order || 0)
      })
      .map((m) => m.url)
  }, [hotel, mediaByHotel])

  const heroImages = useMemo(
    () => [...new Set([...hotelImages, ...HERO_EXTRAS, DHAKA_NIGHT])],
    [hotelImages]
  )

  const lowestPrice = useMemo(() => {
    const p = roomTypes.map((rt) => Number(rt.base_price || 0)).filter((n) => n > 0)
    return p.length ? Math.min(...p) : null
  }, [roomTypes])

  const viewCount = useMemo(
    () => new Set(roomTypes.map((rt) => rt.view_type).filter(Boolean)).size,
    [roomTypes]
  )

  const fullAddress = useMemo(() => {
    if (!hotel) return ''
    return [hotel.address, hotel.city, hotel.country].filter(Boolean).join(', ')
  }, [hotel])

  const directionsUrl = fullAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel.name} ${fullAddress}`)}`
    : null

  // Both entry points carry startAlice, so the concierge can begin speaking
  // on arrival — the guest's click here is the browser interaction that
  // permits audio, so no separate "start voice" button is needed.
  function onSearch({ checkIn, checkOut, guests }) {
    navigate(
      `/hotels/${hotel?.id || ''}?check_in_date=${encodeURIComponent(checkIn)}&check_out_date=${encodeURIComponent(checkOut)}&guests=${guests}&auto_search=1`,
      { state: { startAlice: true } }
    )
  }

  const openHotel = () => hotel && navigate(`/hotels/${hotel.id}`, { state: { startAlice: true } })

  const collage = [hotelImages[0], hotelImages[1] || HERO_EXTRAS[0], hotelImages[2] || HERO_EXTRAS[1]]

  return (
    <AppLayout>
      <div className="relative left-1/2 -ml-[50vw] w-screen -mt-6 lg:-mt-8">

        <section className="relative h-[72vh] min-h-[580px] bg-[#132840]">
          <CinematicHero images={heroImages} alt={hotel?.name || 'IHG Hospitality'} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/65" />
          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-white/70">
              {hotel?.city ? `${hotel.city}${hotel.country ? ` · ${hotel.country}` : ''}` : 'Dhaka · Bangladesh'}
            </p>
            <h1 className="mt-6 max-w-4xl font-serif text-6xl leading-[1.02] text-white sm:text-8xl">
              {hotel?.name || 'IHG Grand Dhaka'}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
              A quieter kind of luxury, in the middle of everything.
            </p>
            <span className="absolute bottom-10 animate-bounce text-white/50"><Icon name="arrowDown" size={22} /></span>
          </div>
        </section>

        <section className="relative z-10 -mt-14 px-4 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W}`}>
            <BookingBar onSearch={onSearch} />
          </div>
        </section>

        <section className="bg-white px-4 py-28 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W} grid gap-16 lg:grid-cols-[1fr_1fr] lg:items-center`}>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">Welcome</p>
              <h2 className="mt-3 font-serif text-5xl leading-[1.08] text-navy sm:text-6xl">
                Room to settle in,<br />and stay a while.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                {hotel?.description
                  || 'Rooms that feel considered rather than decorated. A team that anticipates rather than reacts. And a location that keeps the city within reach without letting its noise past the door.'}
              </p>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                Choose the exact room you want — not a category, an actual room, with its own photographs and
                its own outlook — then book it in a few taps.
              </p>

              {!loading && (
                <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-8">
                  <div>
                    <p className="font-serif text-4xl text-navy">{roomTypes.length || '—'}</p>
                    <p className="mt-1 text-sm text-slate-500">Room types</p>
                  </div>
                  <div>
                    <p className="font-serif text-4xl text-navy">{viewCount || '—'}</p>
                    <p className="mt-1 text-sm text-slate-500">Distinct views</p>
                  </div>
                  <div>
                    <p className="font-serif text-4xl text-navy">{lowestPrice != null ? `$${lowestPrice.toFixed(0)}` : '—'}</p>
                    <p className="mt-1 text-sm text-slate-500">From, per night</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 grid-rows-6 gap-4 lg:h-[560px]">
              {collage[0] && <img src={collage[0]} alt="" className="col-span-3 row-span-4 h-full w-full rounded-2xl object-cover" />}
              {collage[1] && <img src={collage[1]} alt="" className="col-span-2 row-span-3 mt-10 h-full w-full rounded-2xl object-cover" />}
              {collage[2] && <img src={collage[2]} alt="" className="col-span-3 row-span-2 h-full w-full rounded-2xl object-cover" />}
              <img src={DHAKA_STREET} alt="Dhaka" className="col-span-2 row-span-3 h-full w-full rounded-2xl object-cover" />
            </div>
          </div>
        </section>

        {!loading && roomTypes.length > 0 && (
          <section className="bg-[#F5F2ED] py-28">
            <div className={`mx-auto ${CONTENT_MAX_W} px-4 sm:px-6 lg:px-8`}>
              <div className="max-w-2xl">
                <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">More room for comfort</p>
                <h2 className="mt-3 font-serif text-5xl text-navy sm:text-6xl">Rooms &amp; Suites</h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Garden, city, sea, mountain and lake — every room type we offer, with the rate and the
                  outlook up front. No surprises at check-in.
                </p>
              </div>
            </div>

            <div className="mt-14">
              <RoomsCarousel roomTypes={roomTypes} onSelect={openHotel} />
            </div>

            <div className="mt-12 text-center">
              <button type="button" onClick={openHotel} className="rounded-xl bg-navy px-8 py-4 text-base font-bold text-white transition hover:bg-[#162f4d]">
                View rooms &amp; book →
              </button>
            </div>
          </section>
        )}

        {loading && (
          <section className="bg-[#F5F2ED] px-4 py-28 sm:px-6 lg:px-8">
            <div className={`mx-auto ${CONTENT_MAX_W} grid gap-6 md:grid-cols-3`}>
              {[1, 2, 3].map((i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200" />)}
            </div>
          </section>
        )}

        {error && !loading && (
          <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
            <div className={`mx-auto ${CONTENT_MAX_W} rounded-2xl border border-red-200 bg-red-50 p-6 text-base text-red-700`}>{error}</div>
          </section>
        )}

        <PromoBand kind="hotel" onCta={openHotel} />

        <section className="bg-white px-4 py-28 sm:px-6 lg:px-8">
          <div className={`mx-auto ${CONTENT_MAX_W}`}>
            <div className="max-w-2xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">One account</p>
              <h2 className="mt-3 font-serif text-5xl leading-tight text-navy sm:text-6xl">One stay, three ways.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Your room, your table and your delivery all live in the same account — one login, one history,
                one bill to settle.
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {[
                { icon: 'bed', eyebrow: 'Stay', title: 'Hotel', copy: 'Browse real rooms with their own galleries, check live availability for your dates, and request housekeeping or in-room service during your stay.', cta: 'Explore rooms', action: openHotel },
                { icon: 'dish', eyebrow: 'Dine', title: 'Restaurant', copy: 'Reserve a table, browse the full menu ahead of time, and order in the dining room without waiting to catch a waiter.', cta: 'View restaurant', action: () => navigate('/restaurants') },
                { icon: 'scooter', eyebrow: 'Deliver', title: 'Food Delivery', copy: 'The same kitchen, brought to your door or your room. Track the order from preparation through to arrival.', cta: 'Order delivery', action: () => navigate('/delivery') },
              ].map((card) => (
                <div key={card.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-8 transition hover:border-navy/25 hover:shadow-lg">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2147]/10 text-[#FF2147]">
                    <Icon name={card.icon} size={22} />
                  </span>
                  <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[#FF2147]">{card.eyebrow}</p>
                  <h3 className="mt-2 font-serif text-3xl text-navy">{card.title}</h3>
                  <p className="mt-3 flex-1 text-base leading-7 text-slate-600">{card.copy}</p>
                  <button type="button" onClick={card.action} className="mt-6 self-start text-sm font-bold text-navy underline underline-offset-4 hover:text-[#FF2147]">
                    {card.cta} →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The neighbourhood — a full-bleed editorial band rather than a
            plain two-column block, with the address presented as a card and
            a real directions link. */}
        <section className="relative overflow-hidden bg-[#0B1B2D] px-4 py-28 sm:px-6 lg:px-8">
          <img src={DHAKA_NIGHT} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B1B2D] via-[#0B1B2D]/92 to-[#0B1B2D]/55" />
          <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-[#FF2147]/10 blur-3xl" />

          <div className={`relative mx-auto ${CONTENT_MAX_W} grid gap-16 lg:grid-cols-[.95fr_1.05fr] lg:items-center`}>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#FF2147]">The neighbourhood</p>
              <h2 className="mt-4 font-serif text-5xl leading-[1.05] text-white sm:text-7xl">
                Around<br />Dhaka.
              </h2>
              <p className="mt-7 max-w-lg text-lg leading-8 text-white/60">
                Close enough to the city's restaurants, markets and offices to walk out into them — far enough
                from the traffic to sleep through it. Two nights of meetings or a long slow weekend: everything
                worth seeing is a short ride away.
              </p>

              {hotel && (
                <div className="mt-10 max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Find us</p>
                  <p className="mt-4 flex items-start gap-3.5 text-[15px] leading-7 text-white">
                    <span className="mt-1 shrink-0 text-[#FF2147]"><Icon name="pin" size={17} /></span>
                    <span>
                      <span className="font-bold">{hotel.name}</span>
                      {fullAddress && <><br />{fullAddress}</>}
                    </span>
                  </p>
                  {hotel.phone && (
                    <p className="mt-4 flex items-center gap-3.5 text-[15px] text-white/70">
                      <span className="shrink-0 text-[#FF2147]"><Icon name="phone" size={17} /></span>
                      <a href={`tel:${hotel.phone}`} className="transition hover:text-white">{hotel.phone}</a>
                    </p>
                  )}
                              {directionsUrl ? (
                    <a href={directionsUrl} target="_blank" rel="noreferrer" className="group mt-7 inline-flex items-center gap-2.5 border-b border-[#FF2147]/40 pb-1 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:border-[#FF2147]">
                      <Icon name="compass" size={15} />
                      Get directions
                      <span className="transition-transform group-hover:translate-x-1"><Icon name="arrow" size={14} /></span>
                    </a>
                  ) : null}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <figure className="col-span-2 overflow-hidden rounded-2xl">
                <img src={DHAKA_NIGHT} alt="Dhaka after dark" className="h-72 w-full object-cover sm:h-[360px]" />
                <figcaption className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Dhaka after dark</figcaption>
              </figure>
              <figure className="overflow-hidden rounded-2xl">
                <img src={DHAKA_STREET} alt="Dhanmondi streets" className="h-52 w-full object-cover" />
                <figcaption className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">The streets nearby</figcaption>
              </figure>
              {hotelImages[0] && (
                <figure className="overflow-hidden rounded-2xl">
                  <img src={hotelImages[0]} alt="" className="h-52 w-full object-cover" />
                  <figcaption className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Back at the hotel</figcaption>
                </figure>
              )}
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  )
}