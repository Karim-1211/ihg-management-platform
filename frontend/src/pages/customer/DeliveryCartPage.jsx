import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../../components/layout/AppLayout'

const CART_KEY = 'ihg_delivery_cart'

export default function DeliveryCartPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  }, [cart])

  const items = useMemo(() => Object.values(cart), [cart])

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  )

  function changeQuantity(id, quantity) {
    setCart((current) => {
      const next = { ...current }

      if (quantity <= 0) {
        delete next[id]
      } else {
        next[id] = {
          ...next[id],
          quantity,
        }
      }

      return next
    })
  }

  function clearCart() {
    setCart({})
  }

  if (items.length === 0) {
    return (
      <AppLayout>
        <div className="min-h-[70vh] bg-[#f7f8fa] flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-6xl mb-5">🛒</div>
            <h1 className="text-3xl font-extrabold text-navy">
              Your basket is empty
            </h1>
            <p className="text-gray-500 mt-2">
              Add something delicious before checking out.
            </p>
            <Link
              to={`/delivery/restaurants/${restaurantId}`}
              className="inline-block mt-6 bg-red text-white rounded-xl px-6 py-3 font-bold"
            >
              Browse menu
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="bg-navy text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7">
            <Link
              to={`/delivery/restaurants/${restaurantId}`}
              className="text-white/70 hover:text-white text-sm"
            >
              ← Back to menu
            </Link>

            <h1 className="text-3xl font-extrabold mt-3">
              Your basket
            </h1>
          </div>
        </div>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28">
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <section className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-5">
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-extrabold text-navy text-xl">
                  Items
                </h2>

                <button
                  onClick={clearCart}
                  className="text-sm font-semibold text-gray-400 hover:text-red"
                >
                  Clear basket
                </button>
              </div>

              <div className="divide-y">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="py-5 flex gap-4"
                  >
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🍽️
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-bold text-navy">
                        {item.name}
                      </h3>

                      <p className="text-sm text-gray-500 mt-1">
                        ${Number(item.price).toFixed(2)}
                      </p>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center border rounded-xl overflow-hidden">
                          <button
                            onClick={() =>
                              changeQuantity(item.id, item.quantity - 1)
                            }
                            className="px-3 py-2 text-navy font-bold"
                          >
                            −
                          </button>

                          <span className="px-3 font-bold text-navy">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              changeQuantity(item.id, item.quantity + 1)
                            }
                            className="px-3 py-2 text-navy font-bold"
                          >
                            +
                          </button>
                        </div>

                        <strong className="text-navy">
                          ${(Number(item.price) * item.quantity).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 h-fit lg:sticky lg:top-6">
              <h2 className="text-xl font-extrabold text-navy">
                Order summary
              </h2>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="border-t mt-5 pt-5 flex justify-between">
                <span className="font-bold text-navy">Subtotal</span>
                <strong className="text-2xl text-navy">
                  ${subtotal.toFixed(2)}
                </strong>
              </div>

              <button
                onClick={() =>
                  navigate(`/delivery/restaurants/${restaurantId}/checkout`)
                }
                className="w-full bg-red text-white rounded-xl py-4 mt-6 font-extrabold"
              >
                Continue to checkout
              </button>
            </aside>
          </div>
        </main>
      </div>
    </AppLayout>
  )
}