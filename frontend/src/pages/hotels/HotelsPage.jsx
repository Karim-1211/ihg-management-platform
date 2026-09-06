import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function HotelsPage() {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/hotels')
      .then((res) => setHotels(res.data))
      .catch(() => setError('Could not load hotels.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <h1 className="text-3xl font-bold text-navy mb-2">Find Your Perfect Stay</h1>
      <p className="text-gray-500 mb-8">Choose a property to browse available rooms</p>

      {loading && <p className="text-gray-500">Loading hotels...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && hotels.length === 0 && (
        <p className="text-gray-500">No hotels available yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels.map((hotel) => (
          <div
            key={hotel.id}
            className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate(`/hotels/${hotel.id}`)}
          >
            <div className="h-40 bg-gradient-to-br from-navy to-navy-dark flex items-center justify-center">
              <span className="text-white text-2xl font-bold">{hotel.name.charAt(0)}</span>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg text-navy mb-1">{hotel.name}</h3>
              <p className="text-gray-500 text-sm mb-3">
                {hotel.city ? `${hotel.city}, ${hotel.country || ''}` : 'Location not set'}
              </p>
              <button className="w-full py-2 bg-red text-white text-sm font-semibold rounded-lg hover:bg-red-dark transition-colors">
                View Rooms
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}