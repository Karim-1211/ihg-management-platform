import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function HotelRoomsPage() {
  const { hotelId } = useParams()
  const [roomTypes, setRoomTypes] = useState([])
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [rooms, setRooms] = useState(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingRoomId, setBookingRoomId] = useState(null)

  useEffect(() => {
    api.get(`/hotels/${hotelId}/room-types`).then((res) => setRoomTypes(res.data))
  }, [hotelId])

  function roomTypeFor(roomTypeId) {
    return roomTypes.find((rt) => rt.id === roomTypeId)
  }

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setBookingMessage('')
    setSearching(true)
    try {
      const res = await api.get('/rooms/available', {
        params: { check_in_date: checkIn, check_out_date: checkOut, hotel_id: hotelId },
      })
      setRooms(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  async function handleBook(roomId) {
    setBookingMessage('')
    setError('')
    setBookingRoomId(roomId)
    try {
      const res = await api.post('/bookings', {
        room_id: roomId,
        check_in_date: checkIn,
        check_out_date: checkOut,
        number_of_guests: 1,
      })
      setBookingMessage(`Booking confirmed! Reference: ${res.data.booking_reference}, Total: $${res.data.total_amount}`)
      setRooms((prev) => prev.filter((r) => r.id !== roomId))
    } catch (err) {
      setError(err.response?.data?.detail || 'Booking failed.')
    } finally {
      setBookingRoomId(null)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-6">Search Available Rooms</h1>

      <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-md p-6 mb-8 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
          <input
            type="date" required value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
          <input
            type="date" required value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>
        <button
          type="submit" disabled={searching}
          className="px-6 py-2 bg-navy text-white font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search Rooms'}
        </button>
      </form>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}
      {bookingMessage && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
          {bookingMessage}
        </div>
      )}

      {rooms !== null && rooms.length === 0 && (
        <p className="text-gray-500">No rooms available for these dates.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms?.map((room) => {
          const rt = roomTypeFor(room.room_type_id)
          return (
            <div key={room.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-gray-500 font-medium">Room {room.room_number}</span>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-navy">{rt?.name || 'Room'}</h3>
                <p className="text-gray-500 text-sm mb-3">Up to {rt?.max_occupancy || '-'} guests · Floor {room.floor ?? '-'}</p>
                <p className="text-xl font-bold text-navy mb-4">${rt?.base_price} <span className="text-sm font-normal text-gray-500">/ night</span></p>
                <button
                  onClick={() => handleBook(room.id)}
                  disabled={bookingRoomId === room.id}
                  className="w-full py-2 bg-red text-white text-sm font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
                >
                  {bookingRoomId === room.id ? 'Booking...' : 'Book Now'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </AppLayout>
  )
}