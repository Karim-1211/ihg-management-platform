import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import RoomGallery from '../../components/customer/hospitality/RoomGallery'
import RoomFinderAssistant from '../../components/customer/hospitality/RoomFinderAssistant'

const NAVY = '#1F3A5F'
const RED = '#FF2147'
const ROOMS_PER_PAGE = 6
const CONTENT_MAX_W = 'max-w-[1280px]'
const PRICE_OPTIONS = [
  { label: 'Any price', value: null },
  { label: 'Up to $100', value: 100 },
  { label: 'Up to $150', value: 150 },
  { label: 'Up to $200', value: 200 },
]

const PROPERTY_STORY = [
  {
    key: 'lobby',
    label: 'Arrival & Lobby',
    caption: 'A warm welcome from the moment you step inside. Sunlight pours through the entrance as our team greets you by name, ready to make the rest of your stay feel effortless — the first impression, and we make sure it lasts.',
    url: 'https://images.unsplash.com/photo-1759038086403-c607d67bb245?fm=jpg&q=80&w=2400&auto=format&fit=crop',
    credit: 'Neon Wang / Unsplash',
  },
  {
    key: 'corridor',
    label: 'Corridors & Interiors',
    caption: 'Quiet, considered spaces guide you from the lobby to your door. Soft lighting and hushed acoustics mean the walk to your room feels like part of the experience, not just a hallway in between — every detail chosen with care.',
    url: 'https://images.unsplash.com/photo-1629138390160-98425d92a9fc?fm=jpg&q=80&w=2400&auto=format&fit=crop',
    credit: 'Jason Mavrommatis / Unsplash',
  },
  {
    key: 'pool',
    label: 'Pool & Outdoors',
    caption: "Unwind by the water, any time of day. Whether it's an early lap before breakfast or a lazy afternoon in the sun, our pool and outdoor spaces are built for genuine rest — comfortable loungers, fresh air, exactly what a getaway should feel like.",
    url: 'https://images.unsplash.com/photo-1698653223783-d6cce8281606?fm=jpg&q=80&w=2400&auto=format&fit=crop',
    credit: 'Mateusz Zatorski / Unsplash',
  },
]

const ROOM_VIEWS = [
  {
    key: 'mountain',
    label: 'Mountain View',
    url: 'https://images.unsplash.com/photo-1664967231678-64af98ccbfce?fm=jpg&q=80&w=1600&auto=format&fit=crop',
    credit: 'Michael Ender / Unsplash',
  },
  {
    key: 'sea',
    label: 'Sea & Veranda View',
    url: 'https://images.unsplash.com/photo-1664189767954-e4e605ae46da?fm=jpg&q=80&w=1600&auto=format&fit=crop',
    credit: 'Robert Katzki / Unsplash',
  },
  {
    key: 'city-day',
    label: 'City View',
    url: 'https://images.unsplash.com/photo-1750072167202-b54f7a2c6bc7?fm=jpg&q=80&w=1600&auto=format&fit=crop',
    credit: 'Raymond Yeung / Unsplash',
  },
  {
    key: 'city-night',
    label: 'City Lights at Night',
    url: 'https://images.unsplash.com/photo-1530258614483-0185dc8d6632?fm=jpg&q=80&w=1600&auto=format&fit=crop',
    credit: '郭心宇 / Unsplash',
  },
]

const DINING_PREVIEW = {
  caption: "You won't need to leave the building for a great meal. Our on-site restaurant is just steps from your room, ready whenever hunger strikes — from a quiet breakfast to a celebratory dinner.",
  url: 'https://images.unsplash.com/photo-1754557619846-0574960c5f3f?fm=jpg&q=80&w=2400&auto=format&fit=crop',
  credit: 'Deepal Tamang / Unsplash',
}

function Icon({ name, className = 'h-5 w-5' }) {
  const common = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.7 }
  if (name === 'calendar') return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3m10-3v3M4.5 9.5h15M6.5 5h11A2.5 2.5 0 0 1 20 7.5v11A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-11A2.5 2.5 0 0 1 6.5 5Z" /></svg>
  if (name === 'users') return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M16 20v-1.2a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4V20m6-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 9v-1.2a4 4 0 0 0-3-3.87M16 4.2a3 3 0 0 1 0 5.6" /></svg>
  if (name === 'arrow') return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" /></svg>
  return null
}

function uniqueMedia(items = []) {
  return [...new Map(items.filter((item) => item?.url).map((item) => [item.url, item])).values()]
}

function CinematicHeroImage({ images, alt }) {
  const safeImages = images.filter(Boolean)
  const [index, setIndex] = useState(0)
  const CYCLE_MS = 4500

  useEffect(() => {
    if (safeImages.length <= 1) return undefined
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % safeImages.length), CYCLE_MS)
    return () => window.clearInterval(timer)
  }, [safeImages.length])

  if (!safeImages.length) return null

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes kenburnsZoom {
          from { transform: scale(1); }
          to { transform: scale(1.13); }
        }
      `}</style>
      {safeImages.map((src, i) => (
        // Stable key — see the note on the other heroes: a changing key
        // forced the browser to re-download each image mid-cycle.
        <img
          key={src}
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[900ms]"
          style={{
            opacity: i === index ? 1 : 0,
            animation: i === index ? `kenburnsZoom ${CYCLE_MS + 900}ms linear forwards` : 'none',
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  )
}

function RoomCardImageCarousel({ images, alt }) {
  const [index, setIndex] = useState(0)
  const INTERVAL_MS = 3500

  useEffect(() => {
    if (images.length <= 1) return undefined
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % images.length), INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [images.length])

  if (!images.length) {
    return <div className="h-full w-full bg-gradient-to-br from-slate-300 to-slate-100" />
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ width: `${images.length * 100}%`, transform: `translateX(-${index * (100 / images.length)}%)` }}
      >
        {images.map((img, i) => (
          <img
            key={img.url || i}
            src={img.url}
            alt={img.alt_text || alt}
            className="h-full shrink-0 object-cover"
            style={{ width: `${100 / images.length}%` }}
          />
        ))}
      </div>
    </div>
  )
}

function SearchBar({ checkIn, setCheckIn, checkOut, setCheckOut, guests, setGuests, onSearch, searching }) {
  const today = new Date().toISOString().slice(0, 10)

  return (
    <form onSubmit={onSearch} className="grid gap-3 rounded-2xl bg-white p-3 shadow-[0_22px_65px_rgba(15,23,42,0.18)] ring-1 ring-black/5 md:grid-cols-[1fr_1fr_.8fr_auto]">
      <label className="flex min-h-[62px] flex-col justify-center border-b border-slate-200 px-4 md:border-b-0 md:border-r">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Check in</span>
        <span className="mt-1 flex items-center gap-2"><Icon name="calendar" className="h-4 w-4 text-slate-400" /><input required min={today} type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full bg-transparent text-base font-semibold text-[#1F3A5F] outline-none" /></span>
      </label>
      <label className="flex min-h-[62px] flex-col justify-center border-b border-slate-200 px-4 md:border-b-0 md:border-r">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Check out</span>
        <span className="mt-1 flex items-center gap-2"><Icon name="calendar" className="h-4 w-4 text-slate-400" /><input required min={checkIn || today} type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full bg-transparent text-base font-semibold text-[#1F3A5F] outline-none" /></span>
      </label>
      <label className="flex min-h-[62px] flex-col justify-center border-b border-slate-200 px-4 md:border-b-0 md:border-r">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Guests</span>
        <span className="mt-1 flex items-center gap-2"><Icon name="users" className="h-4 w-4 text-slate-400" /><select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full bg-transparent text-base font-semibold text-[#1F3A5F] outline-none">{[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}</select></span>
      </label>
      <button disabled={searching} type="submit" className="flex min-h-[62px] items-center justify-center gap-2 rounded-xl bg-[#FF2147] px-7 text-base font-bold uppercase tracking-[0.06em] text-white hover:bg-[#dc1539] disabled:opacity-50">{searching ? 'Checking...' : 'Check availability'} <Icon name="arrow" className="h-4 w-4" /></button>
    </form>
  )
}

function StickySearchBar({ visible, hotelName, checkIn, setCheckIn, checkOut, setCheckOut, guests, setGuests, onSearch, searching }) {
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className={`fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/97 shadow-md backdrop-blur transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'}`}>
      <form onSubmit={onSearch} className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-5 py-2.5 sm:gap-3 sm:px-8">
        <span className="hidden shrink-0 text-sm font-bold text-[#1F3A5F] lg:block">{hotelName}</span>
        <input required min={today} type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
        <span className="text-slate-300">→</span>
        <input required min={checkIn || today} type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
        <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
        </select>
        <button disabled={searching} type="submit" className="ml-auto rounded-lg bg-[#FF2147] px-5 py-2 text-sm font-bold text-white hover:bg-[#dc1539] disabled:opacity-50">{searching ? '...' : 'Search'}</button>
      </form>
    </div>
  )
}

function FilterBar({ viewTypes, filterView, setFilterView, filterMaxPrice, setFilterMaxPrice, filterBalconyOnly, setFilterBalconyOnly }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setFilterView('all')} className={`rounded-full px-4 py-2 text-xs font-bold transition ${filterView === 'all' ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>All views</button>
      {viewTypes.map((v) => (
        <button key={v} type="button" onClick={() => setFilterView(v)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${filterView === v ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{v}</button>
      ))}
      <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
      <select
        value={filterMaxPrice ?? ''}
        onChange={(e) => setFilterMaxPrice(e.target.value ? Number(e.target.value) : null)}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 outline-none hover:bg-slate-50"
      >
        {PRICE_OPTIONS.map((opt) => <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>)}
      </select>
      <button type="button" onClick={() => setFilterBalconyOnly((v) => !v)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${filterBalconyOnly ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>Balcony only</button>
    </div>
  )
}

function RoomCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="h-[400px] shrink-0 animate-pulse bg-slate-200" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-6 w-20 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="mt-auto h-10 w-full animate-pulse rounded-xl bg-slate-200" />
      </div>
    </div>
  )
}

function RoomCard({ room, roomType, media, searched, available, scarcityCount, onGallery, onBook }) {
  const isOperationallyUnavailable = room.status !== 'READY'
  const unavailable = isOperationallyUnavailable || (searched && !available)
  const status = room.status === 'CLEANING'
    ? 'BEING PREPARED'
    : isOperationallyUnavailable
      ? 'OUT OF SERVICE'
      : !searched ? 'SELECT DATES' : available ? 'AVAILABLE' : 'BOOKED FOR DATES'
  const statusClass = status === 'AVAILABLE' ? 'bg-emerald-500' : status === 'SELECT DATES' ? 'bg-[#1F3A5F]' : status === 'BEING PREPARED' ? 'bg-amber-500' : 'bg-slate-600'
  const showScarcity = searched && available && scarcityCount != null && scarcityCount <= 2

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="relative h-[400px] shrink-0 bg-slate-200">
        <RoomCardImageCarousel images={media} alt={`${roomType?.name || 'Room'} ${room.room_number}`} />
        <span className={`absolute left-4 top-4 z-10 rounded-full ${statusClass} px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white`}>{status}</span>
        <button type="button" onClick={onGallery} className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur-sm hover:bg-black/85">View gallery · {media.length}</button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#FF2147]">{roomType?.name || 'Room'}</p>
            <h3 className="mt-1 text-xl font-bold text-[#1F3A5F]">Room {room.room_number}</h3>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xl font-bold text-[#1F3A5F]">${Number(roomType?.base_price || 0).toFixed(2)}</p>
            <p className="text-xs text-slate-400">per night</p>
          </div>
        </div>

        {showScarcity && (
          <p className="mt-2 text-xs font-bold text-amber-600">
            Only {scarcityCount} {roomType?.name || 'room'}{scarcityCount === 1 ? '' : 's'} left for your dates
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {roomType?.bed_configuration && <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">{roomType.bed_configuration}</span>}
          {roomType?.view_type && <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">{roomType.view_type}</span>}
          <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">Up to {roomType?.max_occupancy || 0} guests</span>
        </div>

        <button type="button" disabled={unavailable} onClick={onBook} className="mt-auto w-full rounded-xl bg-[#FF2147] py-3 text-sm font-bold text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:bg-slate-300">
          {status === 'AVAILABLE' ? 'Book this room' : status === 'SELECT DATES' ? 'Choose dates & book' : status}
        </button>
      </div>
    </article>
  )
}

function StoryBlock({ media, index }) {
  const reversed = index % 2 === 1
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={`overflow-hidden rounded-2xl ${reversed ? 'lg:order-2' : ''}`}>
        <img src={media.url} alt={media.label} className="h-[320px] w-full object-cover sm:h-[400px]" />
      </div>
      <div className={reversed ? 'lg:order-1' : ''}>
        <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-[#FF2147]">{media.label}</p>
        <p className="mt-4 text-lg leading-8 text-slate-600">{media.caption}</p>
      </div>
    </div>
  )
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#1F3A5F] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">← Prev</button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button key={p} type="button" onClick={() => onChange(p)} className={`h-10 w-10 rounded-xl text-sm font-bold transition ${p === page ? 'bg-[#FF2147] text-white' : 'border border-slate-300 bg-white text-[#1F3A5F] hover:bg-slate-50'}`}>{p}</button>
      ))}
      <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[#1F3A5F] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next →</button>
    </div>
  )
}

export default function HotelRoomsPage() {
  const { hotelId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [hotel, setHotel] = useState(null)
  const [hotelMedia, setHotelMedia] = useState([])
  const [roomTypes, setRoomTypes] = useState([])
  const [rooms, setRooms] = useState([])
  const [roomMedia, setRoomMedia] = useState({})
  const [roomTypeMedia, setRoomTypeMedia] = useState({})
  const [availableRoomIds, setAvailableRoomIds] = useState(new Set())
  const [searched, setSearched] = useState(false)
  const [checkIn, setCheckIn] = useState(searchParams.get('check_in_date') || '')
  const [checkOut, setCheckOut] = useState(searchParams.get('check_out_date') || '')
  const [guests, setGuests] = useState(Number(searchParams.get('guests') || 2))
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [roomsPage, setRoomsPage] = useState(1)
  const [pageLoading, setPageLoading] = useState(true)
  const [showSticky, setShowSticky] = useState(false)
  const [filterView, setFilterView] = useState('all')
  const [filterMaxPrice, setFilterMaxPrice] = useState(null)
  const [filterBalconyOnly, setFilterBalconyOnly] = useState(false)

  const heroSentinelRef = useRef(null)
  const heroRef = useRef(null)
  const conciergeSectionRef = useRef(null)

  const location = useLocation()
  // Alice starts speaking on a real guest click — either arriving here from
  // "Check availability" / "View rooms & book", or pressing the search
  // button on this page. That click is the browser interaction that permits
  // audio, so no separate "start voice" button is needed.
  const [aliceSignal, setAliceSignal] = useState(location.state?.startAlice ? 1 : 0)

  useEffect(() => {
    let mounted = true

    async function load() {
      setPageLoading(true)
      try {
        const [hotelsRes, typesRes, roomsRes, hotelMediaRes] = await Promise.all([
          api.get('/hotels'),
          api.get(`/hotels/${hotelId}/room-types`),
          api.get('/rooms', { params: { hotel_id: hotelId } }),
          api.get('/media', { params: { entity_type: 'HOTEL', entity_id: hotelId } }),
        ])

        if (!mounted) return

        const currentHotel = (hotelsRes.data || []).find((item) => item.id === hotelId) || null
        const types = typesRes.data || []
        const physicalRooms = roomsRes.data || []

        setHotel(currentHotel)
        setRoomTypes(types)
        setRooms(physicalRooms)
        setHotelMedia(hotelMediaRes.data || [])

        const typeEntries = await Promise.all(types.map(async (type) => {
          try {
            const response = await api.get('/media', { params: { entity_type: 'ROOM_TYPE', entity_id: type.id } })
            return [type.id, response.data || []]
          } catch {
            return [type.id, []]
          }
        }))

        const roomEntries = await Promise.all(physicalRooms.map(async (room) => {
          try {
            const response = await api.get('/media', { params: { entity_type: 'ROOM', entity_id: room.id } })
            return [room.id, response.data || []]
          } catch {
            return [room.id, []]
          }
        }))

        if (mounted) {
          setRoomTypeMedia(Object.fromEntries(typeEntries))
          setRoomMedia(Object.fromEntries(roomEntries))
        }
      } catch (err) {
        if (mounted) setError(err.response?.data?.detail || 'Could not load this hotel.')
      } finally {
        if (mounted) setPageLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [hotelId])

  useEffect(() => {
    const el = heroSentinelRef.current
    if (!el) return undefined
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting), { threshold: 0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Fixes the "lands somewhere random" bug: React Router keeps whatever
  // scroll position the PREVIOUS page had, so without this the landing
  // spot here depends on where you happened to be scrolled to on /hotels.
  // Explicitly sets the landing position every time this page mounts —
  // at least half the hero, growing further only if needed so the full
  // AI Concierge card is never cut off.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.setTimeout(() => {
        const heroEl = heroRef.current
        const conciergeEl = conciergeSectionRef.current
        if (!heroEl) return
        const heroHalf = heroEl.offsetHeight / 2
        let target = heroHalf
        if (conciergeEl) {
          const conciergeBottom = conciergeEl.getBoundingClientRect().bottom + window.scrollY
          const minForFullConcierge = conciergeBottom - window.innerHeight
          target = Math.max(heroHalf, minForFullConcierge)
        }
        window.scrollTo({ top: Math.max(0, target), behavior: 'auto' })
      }, 60)
    })
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setRoomsPage(1)
  }, [filterView, filterMaxPrice, filterBalconyOnly, rooms.length])

  async function runSearch(event) {
    event?.preventDefault()
    setError('')

    if (!checkIn || !checkOut) {
      setError('Choose your check-in and check-out dates first.')
      return
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.')
      return
    }

    if (event) setAliceSignal((n) => n + 1)
    setSearching(true)
    try {
      const response = await api.get('/rooms/available', {
        params: { check_in_date: checkIn, check_out_date: checkOut, hotel_id: hotelId },
      })
      setAvailableRoomIds(new Set((response.data || []).map((room) => room.id)))
      setSearched(true)
      setSearchParams({ check_in_date: checkIn, check_out_date: checkOut, guests: String(guests) })
    } catch (err) {
      setError(err.response?.data?.detail || 'Availability search failed.')
      setSearched(false)
      setAvailableRoomIds(new Set())
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (searchParams.get('auto_search') === '1' && checkIn && checkOut) {
      runSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function galleryFor(room) {
    const specific = uniqueMedia(roomMedia[room.id] || [])
    if (specific.length) return specific
    return uniqueMedia(roomTypeMedia[room.room_type_id] || [])
  }

  function bookRoom(room) {
    const roomType = roomTypes.find((item) => item.id === room.room_type_id)
    const params = new URLSearchParams({
      hotelId,
      roomId: room.id,
      roomTypeId: room.room_type_id,
      roomNumber: room.room_number,
      roomTypeName: roomType?.name || 'Hotel Room',
      price: String(roomType?.base_price || 0),
      guests: String(guests),
    })
    if (checkIn) params.set('checkIn', checkIn)
    if (checkOut) params.set('checkOut', checkOut)
    navigate(`/hotels/${hotelId}/booking/checkout?${params.toString()}`)
  }

  const heroImages = useMemo(() => hotelMedia.map((item) => item.url).filter(Boolean), [hotelMedia])

  const viewTypes = useMemo(
    () => [...new Set(roomTypes.map((rt) => rt.view_type).filter(Boolean))],
    [roomTypes]
  )

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const rt = roomTypes.find((item) => item.id === room.room_type_id)
      if (!rt) return true
      if (filterView !== 'all' && rt.view_type !== filterView) return false
      if (filterMaxPrice && Number(rt.base_price) > filterMaxPrice) return false
      if (filterBalconyOnly && !rt.has_balcony) return false
      return true
    })
  }, [rooms, roomTypes, filterView, filterMaxPrice, filterBalconyOnly])

  const availableCountByType = useMemo(() => {
    if (!searched) return {}
    const counts = {}
    rooms.forEach((room) => {
      if (availableRoomIds.has(room.id)) {
        counts[room.room_type_id] = (counts[room.room_type_id] || 0) + 1
      }
    })
    return counts
  }, [rooms, availableRoomIds, searched])

  const totalRoomPages = Math.max(1, Math.ceil(filteredRooms.length / ROOMS_PER_PAGE))
  const pagedRooms = filteredRooms.slice((roomsPage - 1) * ROOMS_PER_PAGE, roomsPage * ROOMS_PER_PAGE)

  return (
    <AppLayout>
      <StickySearchBar
        visible={showSticky}
        hotelName={hotel?.name}
        checkIn={checkIn} setCheckIn={setCheckIn}
        checkOut={checkOut} setCheckOut={setCheckOut}
        guests={guests} setGuests={setGuests}
        onSearch={runSearch} searching={searching}
      />

      <div className="relative left-1/2 -ml-[50vw] w-screen -mt-8">
        <section ref={heroRef} className="relative h-[72vh] min-h-[560px] bg-[#0E2036]">
          <CinematicHeroImage images={heroImages} alt={hotel?.name || 'Hotel'} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071827]/85 via-[#071827]/35 to-transparent" />
          <div className={`relative z-10 mx-auto flex h-full ${CONTENT_MAX_W} items-end px-5 pb-36 sm:px-8 lg:px-10`}>
            <div className="max-w-3xl text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{hotel?.city ? `${hotel.city}${hotel.country ? ` · ${hotel.country}` : ''}` : 'IHG Hospitality'}</p>
              <h1 className="mt-4 font-serif text-5xl leading-[.98] sm:text-7xl">{hotel?.name || 'Your stay begins here.'}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">Choose a specific room, inspect its own gallery, then select your dates and complete checkout.</p>
            </div>
          </div>
          <div className={`absolute bottom-0 left-0 right-0 z-20 mx-auto ${CONTENT_MAX_W} translate-y-1/2 px-5 sm:px-8 lg:px-10`}>
            <SearchBar checkIn={checkIn} setCheckIn={setCheckIn} checkOut={checkOut} setCheckOut={setCheckOut} guests={guests} setGuests={setGuests} onSearch={runSearch} searching={searching} />
          </div>
        </section>

        <div ref={heroSentinelRef} />

        <section ref={conciergeSectionRef} className="bg-[#F5F2ED] px-5 pb-16 pt-28 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1100px]">
            <RoomFinderAssistant
              hotelId={hotelId}
              defaultCheckIn={checkIn}
              defaultCheckOut={checkOut}
              defaultGuests={guests}
              startVoiceSignal={aliceSignal}
            />
          </div>
        </section>

        <section id="rooms-suites" className="bg-[#F5F2ED] px-5 pb-20 sm:px-8 lg:px-10">
          <div className={`mx-auto ${CONTENT_MAX_W}`}>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">Accommodation</p>
                <h2 className="mt-3 font-serif text-5xl text-[#1F3A5F] sm:text-6xl">Rooms & Suites</h2>
                <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
                  Browse every room in the house, not just a filtered few. Choose your dates and we'll show you,
                  room by room, exactly what's free to book right now — so what you see is exactly what you get.
                </p>
              </div>
              {searched && <p className="text-base font-semibold text-[#1F3A5F]">{checkIn} → {checkOut} · {guests} {guests === 1 ? 'guest' : 'guests'}</p>}
            </div>

            {viewTypes.length > 0 && (
              <FilterBar
                viewTypes={viewTypes}
                filterView={filterView} setFilterView={setFilterView}
                filterMaxPrice={filterMaxPrice} setFilterMaxPrice={setFilterMaxPrice}
                filterBalconyOnly={filterBalconyOnly} setFilterBalconyOnly={setFilterBalconyOnly}
              />
            )}

            {error && <div className="mt-7 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base text-red-700">{error}</div>}

            {pageLoading ? (
              <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => <RoomCardSkeleton key={i} />)}
              </div>
            ) : (
              <>
                <div className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
                  {pagedRooms.map((room) => {
                    const roomType = roomTypes.find((item) => item.id === room.room_type_id)
                    const media = galleryFor(room)
                    return (
                      <RoomCard
                        key={room.id}
                        room={room}
                        roomType={roomType}
                        media={media}
                        searched={searched}
                        available={availableRoomIds.has(room.id)}
                        scarcityCount={availableCountByType[room.room_type_id]}
                        onGallery={() => setSelectedRoom({ room, roomType, media })}
                        onBook={() => bookRoom(room)}
                      />
                    )
                  })}
                </div>

                {!filteredRooms.length && !error && (
                  <div className="mt-10 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-base text-slate-500">
                    {rooms.length ? 'No rooms match these filters — try clearing one.' : 'No rooms are configured for this hotel yet.'}
                  </div>
                )}

                {filteredRooms.length > ROOMS_PER_PAGE && (
                  <>
                    <p className="mt-8 text-center text-sm text-slate-500">
                      Showing {(roomsPage - 1) * ROOMS_PER_PAGE + 1}–{Math.min(roomsPage * ROOMS_PER_PAGE, filteredRooms.length)} of {filteredRooms.length} rooms
                    </p>
                    <Pagination page={roomsPage} totalPages={totalRoomPages} onChange={setRoomsPage} />
                  </>
                )}
              </>
            )}
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
          <div className={`mx-auto ${CONTENT_MAX_W} space-y-16`}>
            <div className="max-w-3xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">The Property</p>
              <h2 className="mt-3 font-serif text-5xl text-[#1F3A5F] sm:text-6xl">Every corner, considered.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                From the moment you arrive to the quiet walk to your door, every space here was designed to feel
                considered, not incidental. A few of the details that set the tone for your stay.
              </p>
            </div>
            {PROPERTY_STORY.map((media, index) => (
              <StoryBlock key={media.key} media={media} index={index} />
            ))}
          </div>
        </section>

        <section className="bg-[#F5F2ED] px-5 py-20 sm:px-8 lg:px-10">
          <div className={`mx-auto ${CONTENT_MAX_W}`}>
            <div className="max-w-3xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">Views</p>
              <h2 className="mt-3 font-serif text-5xl text-[#1F3A5F] sm:text-6xl">A world outside your window.</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">
                The right view can turn a good stay into an unforgettable one. From misty mountain ridgelines to
                glittering city skylines, explore the vistas waiting just beyond your window — then tell our AI
                Concierge which one speaks to you.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {ROOM_VIEWS.map((view) => (
                <div key={view.key} className="group relative h-72 overflow-hidden rounded-2xl">
                  <img src={view.url} alt={view.label} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                  <p className="absolute bottom-4 left-4 right-4 text-base font-bold text-white">{view.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 sm:px-8 lg:px-10">
          <div className={`mx-auto grid ${CONTENT_MAX_W} gap-10 lg:grid-cols-2 lg:items-center`}>
            <div className="overflow-hidden rounded-2xl">
              <img src={DINING_PREVIEW.url} alt="On-site dining" className="h-[420px] w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.2em] text-[#FF2147]">Dine With Us</p>
              <h2 className="mt-3 font-serif text-5xl text-[#1F3A5F] sm:text-6xl">On-site dining, just steps away.</h2>
              <p className="mt-4 max-w-lg text-lg leading-8 text-slate-600">{DINING_PREVIEW.caption}</p>
              <button
                type="button"
                onClick={() => navigate('/restaurants')}
                className="mt-7 rounded-xl bg-[#1F3A5F] px-6 py-3.5 text-base font-bold text-white transition hover:bg-[#162f4d]"
              >
                Explore Our Restaurant →
              </button>
            </div>
          </div>
        </section>

        {selectedRoom && (
          <RoomGallery
            roomName={`Room ${selectedRoom.room.room_number} · ${selectedRoom.roomType?.name || 'Room'}`}
            images={selectedRoom.media}
            onClose={() => setSelectedRoom(null)}
          />
        )}
      </div>
    </AppLayout>
  )
}