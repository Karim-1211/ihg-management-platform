import DeliveryAIAssistant from '../../components/ai/DeliveryAIAssistant'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const CATEGORIES = ['All', 'Popular', 'Pizza', 'Burgers', 'Asian', 'Desserts', 'Drinks']

function RestaurantImage({ restaurant }) {
  const image =
    restaurant.image_url ||
    restaurant.media_url ||
    restaurant.cover_image_url ||
    restaurant.logo_url

  return image ? (
    <img
      src={image}
      alt={restaurant.name}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full bg-gradient-to-br from-navy to-[#355b85] flex items-center justify-center">
      <span className="text-5xl">🍽️</span>
    </div>
  )
}

export default function DeliveryHomePage() {
  const navigate = useNavigate()
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    api.get('/restaurants')
      .then((res) => setRestaurants(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Could not load restaurants.'))
      .finally(() => setLoading(false))
  }, [])

  const filteredRestaurants = useMemo(() => {
    const q = search.trim().toLowerCase()

    return restaurants.filter((restaurant) => {
      const name = String(restaurant.name || '').toLowerCase()
      const description = String(restaurant.description || '').toLowerCase()

      const matchesSearch =
        !q || name.includes(q) || description.includes(q)

      const haystack = `${name} ${description}`

      const matchesCategory =
        category === 'All' ||
        category === 'Popular' ||
        haystack.includes(category.toLowerCase())

      return matchesSearch && matchesCategory
    })
  }, [restaurants, search, category])

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">
        <section className="relative overflow-hidden bg-navy">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,33,71,.28),transparent_35%)]" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="max-w-3xl">
              <p className="text-red font-bold uppercase tracking-[0.22em] text-xs mb-4">
                IHG Delivery
              </p>

              <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
                Good food,
                <br />
                delivered beautifully.
              </h1>

              <p className="mt-5 text-white/70 text-lg max-w-xl">
                Discover restaurants, explore their menus and have your
                favourites delivered to your door.
              </p>

              <div className="mt-8 max-w-2xl">
                <div className="bg-white rounded-2xl p-2 shadow-2xl flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 flex items-center px-4">
                    <span className="text-gray-400 mr-3">⌕</span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search restaurants or food..."
                      className="w-full py-3 outline-none text-navy placeholder:text-gray-400"
                    />
                  </div>

                  <button
                    onClick={() =>
                      document
                        .getElementById('restaurants')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="bg-red text-white rounded-xl px-7 py-3 font-bold hover:opacity-90"
                  >
                    Explore
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <main
          id="restaurants"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-7">
            <div>
              <p className="text-red text-xs font-bold uppercase tracking-[0.18em]">
                Discover
              </p>
              <h2 className="text-3xl font-extrabold text-navy mt-1">
                Restaurants near you
              </h2>
              <p className="text-gray-500 mt-2">
                Choose a restaurant and start building your basket.
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  onClick={() => setCategory(item)}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold transition ${
                    category === item
                      ? 'bg-navy text-white'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-navy'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="py-20 text-center text-gray-400">
              Loading restaurants...
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red rounded-2xl p-5">
              {error}
            </div>
          )}

          {!loading && !error && filteredRestaurants.length === 0 && (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
              <div className="text-5xl mb-4">🍴</div>
              <h3 className="text-xl font-bold text-navy">
                No restaurants found
              </h3>
              <p className="text-gray-500 mt-2">
                Try another search or category.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant) => (
              <Link
                key={restaurant.id}
                to={`/delivery/restaurants/${restaurant.id}`}
                className="group bg-white rounded-3xl overflow-hidden shadow-sm ring-1 ring-black/5 hover:shadow-xl transition"
              >
                <div className="h-52 overflow-hidden">
                  <div className="w-full h-full group-hover:scale-105 transition duration-500">
                    <RestaurantImage restaurant={restaurant} />
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-navy">
                        {restaurant.name}
                      </h3>

                      {restaurant.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {restaurant.description}
                        </p>
                      )}
                    </div>

                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold ${
                        restaurant.is_active === false
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {restaurant.is_active === false ? 'Closed' : 'Open'}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      Explore menu
                    </span>
                    <span className="text-red font-bold">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
      <DeliveryAIAssistant />
    </AppLayout>
  )
}