import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const CART_KEY = 'ihg_delivery_cart'

export default function DeliveryCheckoutPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()

  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '{}')
    } catch {
      return {}
    }
  })

  const [address, setAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('DEMO')
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState('')

  const items = useMemo(() => Object.values(cart), [cart])

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity,
    0
  )

  const estimatedTax = subtotal * 0.05
  const estimatedTotal = subtotal + estimatedTax

  async function handlePlaceOrder() {
    setError('')

    if (!address.trim()) {
      setError('Please enter your delivery address.')
      return
    }

    if (!items.length) {
      setError('Your basket is empty.')
      return
    }

    setPlacing(true)

    try {
      const response = await api.post('/orders', {
        restaurant_id: restaurantId,
        order_type: 'DELIVERY',
        delivery_address: address.trim(),
        items: items.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
        })),
      })

      const order = response.data

      localStorage.removeItem(CART_KEY)

      navigate(`/delivery/orders/${order.id}/confirmation`, {
        state: {
          order,
          paymentMethod,
        },
      })
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        'Could not place your order. Please try again.'
      )
    } finally {
      setPlacing(false)
    }
  }

  if (!items.length) {
    return (
      <AppLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <p className="text-gray-500">Your basket is empty.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">
        <div className="bg-navy text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
            <p className="text-white/60 text-sm">Delivery checkout</p>
            <h1 className="text-3xl font-extrabold mt-1">
              Almost there
            </h1>
          </div>
        </div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24">
          {error && (
            <div className="mb-6 bg-red-50 text-red rounded-2xl p-4 font-medium">
              {error}
            </div>
          )}

          <div className="grid lg:grid-cols-[1fr_380px] gap-6">
            <div className="space-y-6">
              <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-extrabold text-navy">
                  Delivery details
                </h2>

                <label className="block mt-6">
                  <span className="text-sm font-bold text-navy">
                    Delivery address
                  </span>

                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={5}
                    placeholder="House number, street, area, city..."
                    className="w-full mt-2 rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-red/20 focus:border-red resize-none"
                  />
                </label>
              </section>

              <section className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-extrabold text-navy">
                  Payment
                </h2>

                <div className="grid sm:grid-cols-3 gap-3 mt-5">
                  {[
                    ['DEMO', 'Demo payment'],
                    ['CARD', 'Visa / Mastercard'],
                    ['MOBILE_PAYMENT', 'Mobile payment'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setPaymentMethod(value)}
                      className={`rounded-2xl border p-4 text-left ${
                        paymentMethod === value
                          ? 'border-red bg-red/5 ring-2 ring-red/10'
                          : 'border-gray-200'
                      }`}
                    >
                      <span className="block font-bold text-navy">
                        {label}
                      </span>
                      <span className="text-xs text-gray-400 mt-1 block">
                        Demo mode
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <aside className="bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5 h-fit lg:sticky lg:top-6">
              <h2 className="text-xl font-extrabold text-navy">
                Review order
              </h2>

              <div className="mt-5 space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-navy">
                        {item.name}
                      </p>
                      <p className="text-gray-400">
                        × {item.quantity}
                      </p>
                    </div>

                    <span className="font-semibold text-navy">
                      ${(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t mt-6 pt-5 space-y-3">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>Tax</span>
                  <span>${estimatedTax.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-navy pt-2">
                  <strong>Total</strong>
                  <strong className="text-2xl">
                    ${estimatedTotal.toFixed(2)}
                  </strong>
                </div>
              </div>

              <button
                disabled={placing}
                onClick={handlePlaceOrder}
                className="w-full bg-red disabled:opacity-50 text-white rounded-xl py-4 mt-6 font-extrabold"
              >
                {placing ? 'Placing order...' : 'Place delivery order'}
              </button>

              <p className="text-xs text-gray-400 text-center mt-4">
                Payment is handled in demo/test mode.
              </p>
            </aside>
          </div>
        </main>
      </div>
    </AppLayout>
  )
}