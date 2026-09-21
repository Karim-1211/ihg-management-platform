import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STEPS = [
  ['PENDING', 'Order received'],
  ['ASSIGNED', 'Driver assigned'],
  ['PICKED_UP', 'Picked up'],
  ['OUT_FOR_DELIVERY', 'On the way'],
  ['DELIVERED', 'Delivered'],
]

function indexFor(status) {
  const index = STEPS.findIndex(([value]) => value === status)
  return index < 0 ? 0 : index
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

export default function DeliveryOrderTrackingPage() {
  const { orderId } = useParams()

  const [delivery, setDelivery] = useState(null)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [deliveryResponse, orderResponse] =
        await Promise.all([
          api.get(`/deliveries/order/${orderId}`),
          api.get(`/orders/${orderId}`),
        ])

      setDelivery(deliveryResponse.data)
      setOrder(orderResponse.data)
      setError('')
    } catch (err) {
      if (err?.response?.status === 403 || err?.response?.status === 404) {
        setError('This order could not be found.')
      } else {
        setError('Unable to refresh tracking right now.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    const timer = setInterval(load, 10000)

    return () => clearInterval(timer)
  }, [orderId])

  const status = delivery?.status || 'PENDING'
  const current = indexFor(status)

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#f7f8fa]">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-20">

          <Link
            to="/my-orders"
            className="text-sm font-semibold text-gray-500 hover:text-navy"
          >
            ← My orders
          </Link>

          {loading && (
            <div className="mt-6 bg-white rounded-3xl p-10 text-center">
              <p className="text-gray-400">
                Loading your order...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="mt-6 bg-red-50 text-red rounded-2xl p-5">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <section className="mt-6 bg-navy text-white rounded-3xl p-6 sm:p-8">
                <p className="text-white/60 text-xs uppercase tracking-[0.18em] font-bold">
                  Live delivery
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-2">
                  <div>
                    <h1 className="text-3xl font-extrabold">
                      {order?.order_number || 'Your order'}
                    </h1>

                    <p className="text-white/70 mt-2">
                      {STEPS[current]?.[1] || 'Processing'}
                    </p>
                  </div>

                  <span className="self-start px-4 py-2 rounded-full bg-white/10 text-sm font-bold">
                    {status.replaceAll('_', ' ')}
                  </span>
                </div>
              </section>

              <section className="mt-5 bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-extrabold text-navy">
                  Delivery status
                </h2>

                <div className="mt-8">
                  {STEPS.map(([value, label], index) => {
                    const complete = index <= current
                    const active = index === current

                    return (
                      <div
                        key={value}
                        className="flex items-start gap-4 relative"
                      >
                        {index < STEPS.length - 1 && (
                          <div
                            className={`absolute left-4 top-8 h-12 w-0.5 ${
                              index < current
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
                          {complete ? '✓' : index + 1}
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
                  })}
                </div>
              </section>

              <section className="mt-5 bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-extrabold text-navy">
                  Order details
                </h2>

                <div className="mt-5 space-y-4">

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">
                      Order number
                    </span>

                    <strong className="text-navy">
                      {order?.order_number || order?.id}
                    </strong>
                  </div>

                  {order?.delivery_address && (
                    <div className="border-t pt-4">
                      <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                        Delivery address
                      </p>

                      <p className="font-semibold text-navy mt-1">
                        {order.delivery_address}
                      </p>
                    </div>
                  )}

                  {order?.items?.length > 0 && (
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

                  {order?.subtotal != null && (
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Subtotal
                        </span>

                        <span className="text-navy">
                          {money(order.subtotal)}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          Tax
                        </span>

                        <span className="text-navy">
                          {money(order.tax_amount)}
                        </span>
                      </div>

                      <div className="flex justify-between pt-2">
                        <strong className="text-navy">
                          Total
                        </strong>

                        <strong className="text-xl text-navy">
                          {money(order.total_amount)}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {delivery?.driver_name && (
                <section className="mt-5 bg-white rounded-3xl p-6 shadow-sm ring-1 ring-black/5">
                  <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                    Delivery driver
                  </p>

                  <p className="text-lg font-extrabold text-navy mt-1">
                    {delivery.driver_name}
                  </p>
                </section>
              )}

              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/my-orders"
                  className="flex-1 text-center bg-white text-navy rounded-xl py-3.5 font-bold ring-1 ring-gray-200"
                >
                  My orders
                </Link>

                <Link
                  to="/delivery"
                  className="flex-1 text-center bg-navy text-white rounded-xl py-3.5 font-bold"
                >
                  Order more food
                </Link>
              </div>

              <p className="text-center text-xs text-gray-400 mt-5">
                Tracking refreshes automatically.
              </p>
            </>
          )}
        </main>
      </div>
    </AppLayout>
  )
}