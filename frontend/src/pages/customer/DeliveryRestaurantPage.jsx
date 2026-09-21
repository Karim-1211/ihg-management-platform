import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const CART_KEY = 'ihg_delivery_cart'

function getStoredCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '{}')
  } catch {
    return {}
  }
}

function MenuImage({ item }) {
  const image = item.image_url

  if (!image) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#eef2f7] to-[#dce5ef] flex items-center justify-center">
        <span className="text-4xl">🍽️</span>
      </div>
    )
  }

  return (
    <img
      src={image}
      alt={item.name}
      className="w-full h-full object-cover"
    />
  )
}

export default function DeliveryRestaurantPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()

  const [restaurant, setRestaurant] = useState(null)
  const [menu, setMenu] = useState([])
  const [cart, setCart] = useState(getStoredCart)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/restaurants/${restaurantId}/menu`)
      .then((res) => {
        const data = res.data
        setMenu(Array.isArray(data) ? data : data.categories || [])
        setRestaurant(data.restaurant || data)
      })
      .catch(() => setError('Could not load this restaurant.'))
      .finally(() => setLoading(false))
  }, [restaurantId])

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const categories = useMemo(() => {
    if (!Array.isArray(menu)) return []

    if (menu.length && menu[0]?.items) return menu

    const groups = {}

    menu.forEach((item) => {
      const category = item.category_name || item.category || 'Menu'
      if (!groups[category]) groups[category] = []
      groups[category].push(item)
    })

    return Object.entries(groups).map(([name, items]) => ({
      name,
      items,
    }))
  }, [menu])

  const cartItems = Object.values(cart)
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  function addToCart(item) {
    setCart((current) => {
      const next = { ...current }
      const key = item.id

      if (next[key]) {
        next[key] = {
          ...next[key],
          quantity: next[key].quantity + 1,
        }
      } else {
        next[key] = {
          id: item.id,
          name: item.name,
          price: Number(item.price),
          image_url: item.image_url || null,
          quantity: 1,
          restaurant_id: restaurantId,
          restaurant_name: restaurant?.name || '',
        }
      }

      return next
    })
  }

  function goToCart() {
    navigate(`/delivery/restaurants/${restaurantId}/cart`)
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="bg-navy">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <Link
              to="/delivery"
              className="text-white/70 hover:text-white text-sm"
            >
              ← Back to delivery
            </Link>
          </div>
        </div>

        {loading && (
          <div className="py-24 text-center text-gray-400">
            Loading menu...
          </div>
        )}

        {error && (
          <div className="max-w-3xl mx-auto px-4 py-20">
            <div className="bg-red-50 text-red rounded-2xl p-5">
              {error}
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="bg-white border-b">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
                  <div>
                    <p className="text-red uppercase tracking-[0.18em] text-xs font-bold">
                      Restaurant
                    </p>

                    <h1 className="text-4xl font-extrabold text-navy mt-1">
                      {restaurant?.name || 'Restaurant'}
                    </h1>

                    {restaurant?.description && (
                      <p className="text-gray-500 mt-3 max-w-2xl">
                        {restaurant.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={goToCart}
                    className="bg-red text-white rounded-xl px-6 py-3 font-bold shadow-sm"
                  >
                    Basket
                    {cartCount > 0 && ` · ${cartCount}`}
                  </button>
                </div>
              </div>
            </section>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-32">
              {categories.map((category) => (
                <section key={category.name} className="mb-12">
                  <div className="mb-5">
                    <h2 className="text-2xl font-extrabold text-navy">
                      {category.name}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {category.items.map((item) => (
                      <article
                        key={item.id}
                        className="bg-white rounded-3xl p-4 shadow-sm ring-1 ring-black/5 flex gap-4"
                      >
                        <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden shrink-0">
                          <MenuImage item={item} />
                        </div>

                        <div className="flex-1 min-w-0 py-1">
                          <div className="flex flex-wrap gap-2">
                            {item.is_signature && (
                              <span className="px-2 py-1 rounded-full bg-red/10 text-red text-[11px] font-bold">
                                Signature
                              </span>
                            )}

                            {(item.dietary_tags || []).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-semibold"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <h3 className="font-bold text-navy text-lg mt-2">
                            {item.name}
                          </h3>

                          {item.description && (
                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                              {item.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between gap-3 mt-4">
                            <span className="font-extrabold text-navy">
                              ${Number(item.price).toFixed(2)}
                            </span>

                            <button
                              disabled={item.is_available === false}
                              onClick={() => addToCart(item)}
                              className={`px-4 py-2 rounded-xl text-sm font-bold ${
                                item.is_available === false
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-navy text-white hover:bg-[#294d74]'
                              }`}
                            >
                              {item.is_available === false
                                ? 'Unavailable'
                                : 'Add'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </main>

            {cartCount > 0 && (
              <div className="fixed bottom-4 left-4 right-4 z-30 md:hidden">
                <button
                  onClick={goToCart}
                  className="w-full bg-red text-white rounded-2xl px-5 py-4 font-extrabold shadow-2xl flex justify-between"
                >
                  <span>View basket</span>
                  <span>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}