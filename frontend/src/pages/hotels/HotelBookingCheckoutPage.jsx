import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppLayout from '../../components/layout/AppLayout'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'

const PAYMENT_METHODS = [
  { value: 'PAYPAL', label: 'PayPal', note: 'Demo PayPal checkout' },
  { value: 'VISA', label: 'Visa', note: 'Demo Visa payment' },
  { value: 'MASTERCARD', label: 'Mastercard', note: 'Demo Mastercard payment' },
]

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)
  const diff = end.getTime() - start.getTime()
  return diff > 0 ? Math.round(diff / 86400000) : 0
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

export default function HotelBookingCheckoutPage() {
  const { hotelId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [room, setRoom] = useState(null)
  const [roomType, setRoomType] = useState(null)
  const [roomImage, setRoomImage] = useState('')
  const [checkIn, setCheckIn] = useState(searchParams.get('checkIn') || '')
  const [checkOut, setCheckOut] = useState(searchParams.get('checkOut') || '')
  const [guests, setGuests] = useState(Number(searchParams.get('guests') || 2))
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('VISA')
  const [availabilityChecked, setAvailabilityChecked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const roomId = searchParams.get('roomId')
  const nights = useMemo(() => nightsBetween(checkIn, checkOut), [checkIn, checkOut])
  const subtotal = useMemo(() => Number(roomType?.base_price || 0) * nights, [roomType, nights])
  const tax = useMemo(() => subtotal * 0.05, [subtotal])
  const total = subtotal + tax

  useEffect(() => {
    if (!user) return
    setGuestName(`${user.first_name || ''} ${user.last_name || ''}`.trim())
    setGuestEmail(user.email || '')
    setGuestPhone(user.phone || '')
  }, [user])

  useEffect(() => {
    let mounted = true

    async function loadRoom() {
      try {
        const [roomsRes, typesRes] = await Promise.all([
          api.get('/rooms', { params: { hotel_id: hotelId } }),
          api.get(`/hotels/${hotelId}/room-types`),
        ])
        const foundRoom = (roomsRes.data || []).find((item) => item.id === roomId)
        const foundType = (typesRes.data || []).find((item) => item.id === foundRoom?.room_type_id)

        if (!foundRoom || !foundType) throw new Error('The selected room could not be found.')

        let image = ''
        try {
          const mediaRes = await api.get('/media', { params: { entity_type: 'ROOM', entity_id: foundRoom.id } })
          image = mediaRes.data?.[0]?.url || ''
        } catch {
          try {
            const fallbackRes = await api.get('/media', { params: { entity_type: 'ROOM_TYPE', entity_id: foundType.id } })
            image = fallbackRes.data?.[0]?.url || foundType.primary_image_url || ''
          } catch {
            image = foundType.primary_image_url || ''
          }
        }

        if (mounted) {
          setRoom(foundRoom)
          setRoomType(foundType)
          setRoomImage(image)
        }
      } catch (err) {
        if (mounted) setError(err.response?.data?.detail || err.message || 'Could not load the selected room.')
      }
    }

    loadRoom()
    return () => { mounted = false }
  }, [hotelId, roomId])

  async function checkAvailability() {
    setError('')
    setAvailabilityChecked(false)

    if (!checkIn || !checkOut) {
      setError('Choose your check-in and check-out dates.')
      return false
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.')
      return false
    }
    if (guests < 1 || guests > Number(roomType?.max_occupancy || 0)) {
      setError(`This room allows a maximum of ${roomType?.max_occupancy || 0} guest(s).`)
      return false
    }

    setChecking(true)
    try {
      const response = await api.get('/rooms/available', {
        params: { check_in_date: checkIn, check_out_date: checkOut, hotel_id: hotelId },
      })
      const available = (response.data || []).some((item) => item.id === roomId)
      if (!available) {
        setError('This room is not available for those dates. Please choose different dates or another room.')
        return false
      }
      setAvailabilityChecked(true)
      return true
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not verify room availability.')
      return false
    } finally {
      setChecking(false)
    }
  }

  async function submitBooking(event) {
    event.preventDefault()
    setError('')

    if (!guestName.trim() || !guestEmail.trim()) {
      setError('Guest name and email are required.')
      return
    }

    const available = availabilityChecked || await checkAvailability()
    if (!available) return

    setSubmitting(true)
    try {
      const response = await api.post('/bookings/checkout', {
        room_id: roomId,
        check_in_date: checkIn,
        check_out_date: checkOut,
        number_of_guests: guests,
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim() || null,
        special_requests: specialRequests.trim() || null,
        payment_method: paymentMethod,
      })

      navigate(`/my-account?tab=bookings&booking=${response.data.booking.id}`, {
        replace: true,
        state: { bookingCompleted: true },
      })
    } catch (err) {
      setError(err.response?.data?.detail || 'Booking could not be completed. Please check the dates again.')
      setAvailabilityChecked(false)
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <button type="button" onClick={() => navigate(-1)} className="text-sm font-semibold text-slate-500 hover:text-[#1F3A5F]">← Back to room</button>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF2147]">Hotel checkout</p>
          <h1 className="mt-2 font-serif text-4xl text-[#1F3A5F] sm:text-5xl">Review your stay</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Select or change your dates here, confirm the guest details, verify live availability, then complete the demo payment.</p>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <form onSubmit={submitBooking} className="grid gap-7 lg:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-7">
            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
              <div className="flex gap-5">
                <div className="h-28 w-36 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-36 sm:w-48">
                  {roomImage && <img src={roomImage} alt={roomType?.name || 'Room'} className="h-full w-full object-cover" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF2147]">Selected room</p>
                  <h2 className="mt-1 text-2xl font-bold text-[#1F3A5F]">Room {room?.room_number || searchParams.get('roomNumber')}</h2>
                  <p className="mt-1 text-sm text-slate-500">{roomType?.name || searchParams.get('roomTypeName') || 'Hotel Room'}</p>
                  <p className="mt-4 text-lg font-bold text-[#1F3A5F]">{money(roomType?.base_price)} <span className="text-xs font-normal text-slate-400">/ night</span></p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
              <h2 className="text-xl font-bold text-[#1F3A5F]">Stay dates & guests</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                <label className="block"><span className="text-sm font-semibold text-slate-700">Check-in *</span><input required min={today} type="date" value={checkIn} onChange={(e) => { setCheckIn(e.target.value); setAvailabilityChecked(false) }} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#1F3A5F]" /></label>
                <label className="block"><span className="text-sm font-semibold text-slate-700">Check-out *</span><input required min={checkIn || today} type="date" value={checkOut} onChange={(e) => { setCheckOut(e.target.value); setAvailabilityChecked(false) }} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#1F3A5F]" /></label>
                <label className="block"><span className="text-sm font-semibold text-slate-700">Guests *</span><select value={guests} onChange={(e) => { setGuests(Number(e.target.value)); setAvailabilityChecked(false) }} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#1F3A5F]">{Array.from({ length: Math.max(Number(roomType?.max_occupancy || 2), 1) }, (_, i) => i + 1).map((value) => <option key={value} value={value}>{value} {value === 1 ? 'Guest' : 'Guests'}</option>)}</select></label>
              </div>
              <button type="button" onClick={checkAvailability} disabled={checking || !room} className="mt-5 rounded-xl border border-[#1F3A5F] px-5 py-3 text-sm font-bold text-[#1F3A5F] hover:bg-slate-50 disabled:opacity-50">{checking ? 'Checking live availability...' : 'Check live availability'}</button>
              {availabilityChecked && <p className="mt-3 text-sm font-semibold text-emerald-600">✓ This exact room is available for your selected dates.</p>}
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
              <h2 className="text-xl font-bold text-[#1F3A5F]">Guest information</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-semibold text-slate-700">Full name *</span><input required value={guestName} onChange={(e) => setGuestName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#1F3A5F]" /></label>
                <label className="block"><span className="text-sm font-semibold text-slate-700">Email *</span><input required type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#1F3A5F]" /></label>
                <label className="block"><span className="text-sm font-semibold text-slate-700">Phone</span><input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#1F3A5F]" /></label>
              </div>
              <label className="mt-5 block"><span className="text-sm font-semibold text-slate-700">Special requests</span><textarea rows={4} value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#1F3A5F]" placeholder="Anything the hotel should know?" /></label>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
              <h2 className="text-xl font-bold text-[#1F3A5F]">Demo payment</h2>
              <p className="mt-1 text-sm text-slate-500">No real money is charged.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {PAYMENT_METHODS.map((method) => {
                  const selected = paymentMethod === method.value
                  return <button key={method.value} type="button" onClick={() => setPaymentMethod(method.value)} className={`rounded-xl border-2 p-4 text-left ${selected ? 'border-[#FF2147] bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}><span className="font-bold text-slate-900">{method.label}</span><span className="mt-1 block text-xs text-slate-500">{method.note}</span></button>
                })}
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl bg-[#1F3A5F] p-6 text-white shadow-xl sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Booking summary</p>
              <h2 className="mt-2 text-2xl font-bold">Room {room?.room_number || searchParams.get('roomNumber')}</h2>
              <div className="mt-7 space-y-4 border-t border-white/15 pt-5 text-sm">
                <div className="flex justify-between gap-4"><span className="text-white/65">Stay</span><span>{nights || 0} night{nights === 1 ? '' : 's'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-white/65">Room rate</span><span>{money(roomType?.base_price)} / night</span></div>
                <div className="flex justify-between gap-4"><span className="text-white/65">Subtotal</span><span>{money(subtotal)}</span></div>
                <div className="flex justify-between gap-4"><span className="text-white/65">Tax</span><span>{money(tax)}</span></div>
                <div className="flex justify-between gap-4 border-t border-white/15 pt-5 text-lg font-bold"><span>Total</span><span>{money(total)}</span></div>
              </div>
              <button type="submit" disabled={submitting || !room || nights <= 0} className="mt-7 w-full rounded-xl bg-[#FF2147] py-4 text-sm font-bold text-white hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:bg-white/20">{submitting ? 'Completing booking...' : `Pay & book · ${money(total)}`}</button>
              <p className="mt-4 text-center text-xs leading-5 text-white/55">The server re-checks the room, dates, occupancy, pricing and payment before confirming the booking.</p>
            </div>
          </aside>
        </form>
      </div>
    </AppLayout>
  )
}