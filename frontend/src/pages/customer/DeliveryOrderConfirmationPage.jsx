import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const DELIVERY_STEPS = [
  ['PENDING', 'Order received'],
  ['ASSIGNED', 'Driver assigned'],
  ['PICKED_UP', 'Picked up'],
  ['OUT_FOR_DELIVERY', 'On the way'],
  ['DELIVERED', 'Delivered'],
]

function stepIndex(status) {
  const index = DELIVERY_STEPS.findIndex(
    ([value]) => value === status
  )

  return index === -1 ? 0 : index
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

export default function DeliveryOrderConfirmationPage() {
  const { orderId } = useParams()
  const location = useLocation()

  const [order, setOrder] = useState(
    location.state?.order || null
  )

  const [delivery, setDelivery] = useState(null)
  const [loading, setLoading] = useState(!order)
  const [error, setError] = useState('')

  async function loadOrder() {
    try {
      const response = await api.get(
        `/orders/${orderId}`
      )

      setOrder(response.data)
      setError('')
    } catch {
      setError('Could not load order details.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDelivery() {
    try {
      const response = await api.get(
        `/deliveries/order/${orderId}`
      )

      setDelivery(response.data)
    } catch {
      // Delivery may briefly be unavailable immediately
      // after order creation.
    }
  }

  useEffect(() => {
    if (!order) {
      loadOrder()
    }

    loadDelivery()
  }, [orderId])

  useEffect(() => {
    const timer = setInterval(
      loadDelivery,
      10000
    )

    return () => clearInterval(timer)
  }, [orderId])

  const status = delivery?.status || 'PENDING'
  const currentIndex = stepIndex(status)

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">

        <div className="bg-navy text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 text-center">

            <div className="mx-auto w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-3xl">
              ✓
            </div>

            <p className="text-white/60 text-sm uppercase tracking-[0.2em] mt-5">
              Order confirmed
            </p>

            <h1 className="text-3xl sm:text-4xl font-extrabold mt-2">
              Your order has been received.
            </h1>

            {order?.order_number && (
              <p className="text-white/70 mt-3">
                Order {order.order_number}
              </p>
            )}
          </div>
        </div>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20">

          {error && (
            <div className="bg-red-50 text-red rounded-2xl p-4 mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="bg-white rounded-3xl p-12 text-center">
              <p className="text-gray-400">
                Loading order...
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              <section className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6">

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-bold">
                      Live tracking
                    </p>

                    <h2 className="text-2xl font-extrabold text-navy mt-1">
                      {DELIVERY_STEPS[currentIndex]?.[1]}
                    </h2>
                  </div>

                  <span className="px-3 py-2 rounded-full bg-red/10 text-red text-xs font-bold">
                    {status.replaceAll('_', ' ')}
                  </span>
                </div>

                <div className="mt-8">
                  {DELIVERY_STEPS.map(
                    ([value, label], index) => {
                      const complete =
                        index <= currentIndex

                      const active =
                        index === currentIndex

                      return (
                        <div
                          key={value}
                          className="flex gap-4 relative"
                        >
                          {index <
                            DELIVERY_STEPS.length - 1 && (
                            <div
                              className={`absolute left-[15px] top-8 w-0.5 h-12 ${
                                index < currentIndex
                                  ? 'bg-red'
                                  : 'bg-gray-200'
                              }`}
                            />
                          )}

                          <div
                            className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                              complete
                                ? 'bg-red text-white'
                                : 'bg-gray-100 text-gray-400'
                            } ${
                              active
                                ? 'ring-4 ring-red/10'
                                : ''
                            }`}
                          >
                            {complete
                              ? '✓'
                              : index + 1}
                          </div>

                          <div className="pb-8">
                            <p
                              className={`font-bold ${
                                complete
                                  ? 'text-navy'
                                  : 'text-gray-400'
                              }`}
                            >
                              {label}
                            </p>

                            {active && (
                              <p className="text-sm text-gray-500 mt-1">
                                Your order is currently here.
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </section>

              <section className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6">

                <h2 className="text-xl font-extrabold text-navy">
                  Order details
                </h2>

                {order && (
                  <div className="mt-5 space-y-4">

                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">
                        Order number
                      </span>

                      <strong className="text-navy">
                        {order.order_number ||
                          order.id}
                      </strong>
                    </div>

                    {order.delivery_address && (
                      <div className="border-t pt-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                          Delivery address
                        </p>

                        <p className="font-semibold text-navy mt-1">
                          {order.delivery_address}
                        </p>
                      </div>
                    )}

                    {order.items?.length > 0 && (
                      <div className="border-t pt-4">
                        <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                          Items
                        </p>

                        <div className="mt-3 space-y-2">
                          {order.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between gap-4 text-sm"
                            >
                              <span className="text-gray-600">
                                {item.quantity} ×{' '}
                                {item.menu_item_name}
                              </span>

                              <span className="font-semibold text-navy">
                                {money(item.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Subtotal
                        </span>

                        <span className="text-navy">
                          {money(order.subtotal)}
                        </span>
                      </div>

                      <div className="flex justify-between mt-2">
                        <span className="text-gray-500">
                          Tax
                        </span>

                        <span className="text-navy">
                          {money(order.tax_amount)}
                        </span>
                      </div>

                      <div className="flex justify-between pt-3 mt-3 border-t">
                        <strong className="text-navy">
                          Total
                        </strong>

                        <strong className="text-xl text-navy">
                          {money(order.total_amount)}
                        </strong>
                      </div>
                    </div>

                  </div>
                )}
              </section>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/delivery"
                  className="flex-1 text-center bg-navy text-white rounded-xl py-3.5 font-bold"
                >
                  Browse more food
                </Link>

                <Link
                  to="/my-orders"
                  className="flex-1 text-center bg-white text-navy rounded-xl py-3.5 font-bold ring-1 ring-gray-200"
                >
                  View my orders
                </Link>
              </div>

            </div>
          )}
        </main>
      </div>
    </AppLayout>
  )
}