import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/restaurants')
      .then((res) => setRestaurants(res.data))
      .catch(() => setError('Could not load restaurants.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <h1 className="text-3xl font-bold text-navy mb-2">Dine With Us</h1>
      <p className="text-gray-500 mb-8">Choose a restaurant to view the menu and order</p>

      {loading && <p className="text-gray-500">Loading restaurants...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && restaurants.length === 0 && <p className="text-gray-500">No restaurants available yet.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {restaurants.map((r) => (
          <div
            key={r.id}
            className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => navigate(`/restaurants/${r.id}`)}
          >
            <div className="h-36 bg-gradient-to-br from-red to-red-dark flex items-center justify-center">
              <span className="text-white text-2xl font-bold">{r.name.charAt(0)}</span>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg text-navy mb-1">{r.name}</h3>
              {r.description && <p className="text-gray-500 text-sm mb-3">{r.description}</p>}
              <button className="w-full py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-dark transition-colors">
                View Menu
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}