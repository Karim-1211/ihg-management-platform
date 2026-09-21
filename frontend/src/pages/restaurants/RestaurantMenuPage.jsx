import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

function ArrowIcon({ direction = 'right' }) {
  return direction === 'right' ? (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 12H6M11 6l-6 6 6 6" /></svg>
  )
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4 4L19 6" /></svg>
}

function RoomGallery({ images, name, large = false }) {
  const [index, setIndex] = useState(0)
  const active = images[index]?.url

  if (!images.length) {
    return (
      <div className={`${large ? 'min-h-[360px]' : 'aspect-[16/10]'} flex items-center justify-center bg-[#1F3A5F]`}>
        <span className="text-sm font-semibold text-white/70">{name}</span>
      </div>
    )
  }

  return (
    <div className={`${large ? 'min-h-[360px]' : 'aspect-[16/10]'} group relative overflow-hidden bg-slate-200`}>
      <img src={active} alt={images[index]?.alt_text || name} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.015]" />
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous room image" onClick={() => setIndex((index - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/20 text-white backdrop-blur-sm hover:bg-white hover:text-[#1F3A5F]"><ArrowIcon direction="left" /></button>
          <button type="button" aria-label="Next room image" onClick={() => setIndex((index + 1) % images.length)} className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/20 text-white backdrop-blur-sm hover:bg-white hover:text-[#1F3A5F]"><ArrowIcon /></button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => <span key={i} className={`h-1.5 rounded-full ${i === index ? 'w-7 bg-white' : 'w-1.5 bg-white/60'}`} />)}
          </div>
        </>
      )}
    </div>
  )
}

function DetailModal({ roomType, images, datesReady, onClose, onBook }) {
  if (!roomType) return null
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#071827]/75 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`${roomType.name} details`}>
      <div className="mx-auto max-w-6xl overflow-hidden bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Room details</p>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center text-2xl text-slate-500 hover:text-[#1F3A5F]" aria-label="Close">×</button>
        </div>
        <div className="grid lg:grid-cols-[1.15fr_.85fr]">
          <RoomGallery images={images} name={roomType.name} large />
          <div className="p-7 sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF2147]">{roomType.view_type || 'Room & suite'}</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#1F3A5F]">{roomType.name}</h2>
            {roomType.description && <p className="mt-5 text-sm leading-7 text-slate-600">{roomType.description}</p>}
            <div className="mt-7 grid grid-cols-2 gap-4 border-y border-slate-200 py-6 text-sm">
              <div><p className="text-xs text-slate-400">Sleeps</p><p className="mt-1 font-semibold text-[#1F3A5F]">{roomType.max_occupancy} guests</p></div>
              <div><p className="text-xs text-slate-400">Bed</p><p className="mt-1 font-semibold text-[#1F3A5F]">{roomType.bed_configuration || 'Not specified'}</p></div>
              <div><p className="text-xs text-slate-400">Balcony</p><p className="mt-1 font-semibold text-[#1F3A5F]">{roomType.has_balcony ? 'Yes' : 'No'}</p></div>
              <div><p className="text-xs text-slate-400">Bathtub</p><p className="mt-1 font-semibold text-[#1F3A5F]">{roomType.has_bathtub ? 'Yes' : 'No'}</p></div>
            </div>
            {roomType.amenities?.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Amenities</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  {roomType.amenities.map((item) => <span key={item} className="flex items-center gap-2"><CheckIcon />{item}</span>)}
                </div>
              </div>
            )}
            <div className="mt-8 flex items-end justify-between gap-5">
              <div><span className="text-xs text-slate-400">From</span><p className="text-3xl font-semibold text-[#1F3A5F]">${Number(roomType.base_price).toFixed(2)}<span className="text-sm font-normal text-slate-400"> / night</span></p></div>
              <button type="button" onClick={() => onBook(roomType)} className="bg-[#FF2147] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#e8193e]">
                {datesReady ? 'Book this room' : 'Choose dates'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoomTypeCard({ roomType, images, availableCount, onOpen, onBook }) {
  return (
    <article className="group overflow-hidden border border-slate-200 bg-white">
      <div className="relative">
        <RoomGallery images={images} name={roomType.name} />
        {roomType.is_signature && <span className="absolute left-5 top-5 bg-white/92 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#1F3A5F] shadow-sm">Signature</span>}
        {availableCount !== null && <span className="absolute right-5 top-5 bg-[#1F3A5F]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">{availableCount} available</span>}
      </div>
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF2147]">{roomType.view_type || 'Room & suite'}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1F3A5F]">{roomType.name}</h3>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">From</p>
            <p className="text-xl font-semibold text-[#1F3A5F]">${Number(roomType.base_price).toFixed(2)}</p>
            <p className="text-[11px] text-slate-400">per night</p>
          </div>
        </div>
        {roomType.description && <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500">{roomType.description}</p>}
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
          <span>{roomType.max_occupancy} guests</span>
          {roomType.bed_configuration && <span>{roomType.bed_configuration}</span>}
          {roomType.has_balcony && <span>Balcony</span>}
          {roomType.has_bathtub && <span>Bathtub</span>}
        </div>
        {roomType.amenities?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{roomType.amenities.slice(0, 4).map((a) => <span key={a} className="border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500">{a}</span>)}</div>}
        <div className="mt-7 flex gap-3">
          <button type="button" onClick={() => onOpen(roomType)} className="flex-1 border border-[#1F3A5F] px-4 py-3 text-sm font-bold text-[#1F3A5F] hover:bg-[#1F3A5F] hover:text-white">View room</button>
          <button type="button" onClick={() => onBook(roomType)} className="flex-1 bg-[#FF2147] px-4 py-3 text-sm font-bold text-white hover:bg-[#e8193e]">{availableCount === null ? 'Choose dates' : 'Book now'}</button>
        </div>
      </div>
    </article>
  )
}

export default function HotelRoomsPage() {
  const { hotelId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [hotel, setHotel] = useState(null)
  const [roomTypes, setRoomTypes] = useState([])
  const [media, setMedia] = useState([])
  const [roomMedia, setRoomMedia] = useState({})
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '')
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '')
  const [guests, setGuests] = useState(Number(searchParams.get('guests')) || 2)
  const [rooms, setRooms] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingRoomId, setBookingRoomId] = useState(null)
  const [selectedRoomType, setSelectedRoomType] = useState(null)
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [hotelsResponse, roomTypesResponse, mediaResponse] = await Promise.all([
          api.get('/hotels'),
          api.get(`/hotels/${hotelId}/room-types`),
          api.get('/media', { params: { entity_type: 'HOTEL', entity_id: hotelId } }),
        ])
        if (!mounted) return
        setHotel((hotelsResponse.data || []).find((item) => item.id === hotelId) || null)
        setRoomTypes(roomTypesResponse.data || [])
        setMedia(mediaResponse.data || [])

        const entries = await Promise.all((roomTypesResponse.data || []).map(async (rt) => {
          try {
            const response = await api.get('/media', { params: { entity_type: 'ROOM_TYPE', entity_id: rt.id } })
            return [rt.id, response.data || []]
          } catch {
            return [rt.id, rt.primary_image_url ? [{ url: rt.primary_image_url, is_primary: true, alt_text: rt.name }] : []]
          }
        }))
        if (mounted) setRoomMedia(Object.fromEntries(entries))
      } catch (err) {
        if (mounted) setError(err.response?.data?.detail || 'Could not load this property.')
      }
    }
    load()
    return () => { mounted = false }
  }, [hotelId])

  const heroImages = useMemo(() => {
    const hotelImages = media.map((item) => item.url).filter(Boolean)
    if (hotelImages.length) return hotelImages
    const roomImage = roomTypes.find((rt) => rt.primary_image_url)?.primary_image_url
    return roomImage ? [roomImage] : []
  }, [media, roomTypes])

  useEffect(() => {
    if (heroImages.length < 2) return undefined
    const timer = window.setInterval(() => setHeroIndex((i) => (i + 1) % heroImages.length), 6000)
    return () => window.clearInterval(timer)
  }, [heroImages.length])

  const availableByType = useMemo(() => {
    if (rooms === null) return null
    return rooms.reduce((map, room) => {
      map[room.room_type_id] = [...(map[room.room_type_id] || []), room]
      return map
    }, {})
  }, [rooms])

  const today = new Date().toISOString().split('T')[0]

  function validateDates() {
    if (!checkIn || !checkOut) {
      setError('Please choose your check-in and check-out dates.')
      return false
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.')
      return false
    }
    return true
  }

  async function handleSearch(event) {
    event?.preventDefault()
    setError('')
    setBookingMessage('')
    if (!validateDates()) return
    setSearching(true)
    try {
      const response = await api.get('/rooms/available', {
        params: { check_in_date: checkIn, check_out_date: checkOut, hotel_id: hotelId },
      })
      setRooms(response.data || [])
      setSearchParams({ checkIn, checkOut, guests: String(guests) })
    } catch (err) {
      setError(err.response?.data?.detail || 'Availability search failed.')
    } finally {
      setSearching(false)
    }
  }

  function handleBookRequest(roomType) {
    setError('')
    setBookingMessage('')
    if (!validateDates()) {
      setSelectedRoomType(roomType)
      return
    }
    const available = availableByType?.[roomType.id] || []
    if (!available.length) {
      setError('No room of this type is available for the selected dates. Please search again or choose another room.')
      return
    }
    handleBook(available[0].id)
  }

  async function handleBook(roomId) {
    if (!validateDates()) return
    setBookingRoomId(roomId)
    setError('')
    setBookingMessage('')
    try {
      const response = await api.post('/bookings', {
        room_id: roomId,
        check_in_date: checkIn,
        check_out_date: checkOut,
        number_of_guests: guests,
      })
      setBookingMessage(`Booking confirmed · ${response.data.booking_reference} · $${Number(response.data.total_amount).toFixed(2)}`)
      setRooms((previous) => previous ? previous.filter((room) => room.id !== roomId) : previous)
      setSelectedRoomType(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Booking failed. Please try again.')
    } finally {
      setBookingRoomId(null)
    }
  }

  function openRoom(roomType) {
    setSelectedRoomType(roomType)
  }

  const heroImage = heroImages[heroIndex % Math.max(heroImages.length, 1)]

  return (
    <AppLayout>
      <div className="-mx-4 -mt-8 sm:-mx-6 lg:-mx-8">
        <section className="relative min-h-[590px] overflow-hidden bg-[#102844]">
          {heroImage ? <img key={heroImage} src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,#42617f_0,#1F3A5F_40%,#102844_80%)]" />}
          <div className="absolute inset-0 bg-gradient-to-r from-[#071827]/85 via-[#102844]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071827]/80 via-transparent to-transparent" />
          <div className="relative mx-auto flex min-h-[590px] max-w-7xl items-end px-5 pb-32 pt-28 sm:px-8">
            <div className="max-w-3xl text-white">
              <button type="button" onClick={() => navigate('/hotels')} className="mb-7 flex items-center gap-2 text-xs font-semibold text-white/65 hover:text-white"><ArrowIcon direction="left" /> All properties</button>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/65">{hotel?.city || 'Hotel'} {hotel?.country ? `· ${hotel.country}` : ''}</p>
              <h1 className="mt-4 text-5xl font-semibold leading-[.98] tracking-[-0.045em] sm:text-7xl">{hotel?.name || 'Your stay'}</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/78 sm:text-lg">{hotel?.description || 'Discover rooms and suites designed for a considered stay.'}</p>
            </div>
          </div>
          {heroImages.length > 1 && (
            <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2">
              <button type="button" aria-label="Previous hotel image" onClick={() => setHeroIndex((heroIndex - 1 + heroImages.length) % heroImages.length)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/10 text-white backdrop-blur-sm hover:bg-white hover:text-[#1F3A5F]"><ArrowIcon direction="left" /></button>
              {heroImages.map((_, i) => <button key={i} type="button" aria-label={`Show hotel image ${i + 1}`} onClick={() => setHeroIndex(i)} className={`h-1.5 rounded-full ${i === heroIndex ? 'w-8 bg-white' : 'w-1.5 bg-white/45'}`} />)}
              <button type="button" aria-label="Next hotel image" onClick={() => setHeroIndex((heroIndex + 1) % heroImages.length)} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/10 text-white backdrop-blur-sm hover:bg-white hover:text-[#1F3A5F]"><ArrowIcon /></button>
            </div>
          )}
        </section>

        <section className="relative z-10 mx-auto -mt-12 max-w-6xl px-4 sm:px-6">
          <form onSubmit={handleSearch} className="grid overflow-hidden border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:grid-cols-[1fr_1fr_.8fr_auto]">
            <label className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Check-in</span>
              <input type="date" required min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="mt-2 w-full bg-transparent text-sm font-semibold text-[#1F3A5F] outline-none" />
            </label>
            <label className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Check-out</span>
              <input type="date" required min={checkIn || today} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="mt-2 w-full bg-transparent text-sm font-semibold text-[#1F3A5F] outline-none" />
            </label>
            <label className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Guests</span>
              <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="mt-2 w-full bg-transparent text-sm font-semibold text-[#1F3A5F] outline-none">
                {[1,2,3,4,5,6,7,8].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
              </select>
            </label>
            <button type="submit" className="flex min-h-[74px] items-center justify-center gap-2 bg-[#FF2147] px-7 text-sm font-bold text-white hover:bg-[#e8193e] disabled:opacity-50">
              {searching ? 'Searching…' : 'Check availability'}
            </button>
          </form>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20 pt-24 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF2147]">Rooms & suites</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#1F3A5F] sm:text-5xl">Choose the room that feels right.</h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-slate-500">
              Explore the room visually first. See the view, bed configuration, amenities and bathroom imagery before selecting your dates.
            </p>
          </div>

          {error && <div className="mt-8 border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
          {bookingMessage && <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span>{bookingMessage}</span><button type="button" onClick={() => navigate('/my-bookings')} className="font-bold underline">View my bookings</button></div>}

          <div className="mt-12 grid gap-10 lg:grid-cols-2">
            {roomTypes.map((roomType) => (
              <RoomTypeCard
                key={roomType.id}
                roomType={roomType}
                images={roomMedia[roomType.id] || (roomType.primary_image_url ? [{ url: roomType.primary_image_url, alt_text: roomType.name }] : [])}
                availableCount={rooms === null ? null : (availableByType[roomType.id] || []).length}
                onOpen={openRoom}
                onBook={handleBookRequest}
              />
            ))}
          </div>

          {!roomTypes.length && !error && <div className="mt-12 border border-slate-200 p-10 text-center text-sm text-slate-500">No room types are available for this property yet.</div>}
        </section>

        <section className="bg-[#F4F1EC]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#FF2147]">Inside the property</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-[#1F3A5F]">A stay worth seeing.</h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-500">Explore the spaces around your room — from arrival to the moments between.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {media.map((item) => (
                <figure key={item.id} className="group relative overflow-hidden bg-slate-200">
                  <img src={item.url} alt={item.alt_text || item.caption || 'Hotel'} loading="lazy" className="aspect-[4/5] h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-5 pt-14 text-sm font-semibold text-white">{item.caption || 'Hotel experience'}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </div>

      <DetailModal
        roomType={selectedRoomType}
        images={selectedRoomType ? (roomMedia[selectedRoomType.id] || []) : []}
        datesReady={Boolean(checkIn && checkOut && checkOut > checkIn)}
        onClose={() => setSelectedRoomType(null)}
        onBook={handleBookRequest}
      />
    </AppLayout>
  )
}
