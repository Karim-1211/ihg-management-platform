import { useEffect, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function DeliveryOrderPage() {
  const { restaurantId } = useParams()
  const location = useLocation()
  const [menu, setMenu] = useState([])
  const [address, setAddress] = useState('')
  const [cart, setCart] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [placing, setPlacing] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    api.get(`/restaurants/${restaurantId}/menu`)
      .then((res) => setMenu(res.data))
      .catch(() => setError('Could not load menu.'))
      .finally(() => setLoading(false))
  }, [restaurantId])

  // Receives whatever the guest chose with Alice. Keyed on location.key so
  // it also works when Alice hands off from the widget while the guest is
  // already on this page (same route, new navigation state).
  useEffect(() => {
    const incoming = location.state?.prefillCart
    if (!incoming) return
    setCart((prev) => {
      const merged = { ...prev }
      for (const [itemId, qty] of Object.entries(incoming)) {
        merged[itemId] = Math.max(merged[itemId] || 0, qty)
      }
      return merged
    })
    setConfirmation(null)
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateQuantity(itemId, delta) {
    setCart((prev) => {
      const current = prev[itemId] || 0
      const next = Math.max(0, current + delta)
      const updated = { ...prev }
      if (next === 0) delete updated[itemId]
      else updated[itemId] = next
      return updated
    })
  }

  function findMenuItem(itemId) {
    for (const category of menu) {
      const found = (category.items || []).find((i) => i.id === itemId)
      if (found) return found
    }
    return null
  }

  const cartEntries = Object.entries(cart)
  const cartTotal = cartEntries.reduce((sum, [itemId, qty]) => {
    const item = findMenuItem(itemId)
    return sum + (item ? Number(item.price) * qty : 0)
  }, 0)

  async function handlePlaceOrder() {
    setError('')
    setConfirmation(null)
    if (!address.trim()) {
      setError('Please enter a delivery address.')
      return
    }
    if (cartEntries.length === 0) {
      setError('Please add at least one item to your order.')
      return
    }
    setPlacing(true)
    try {
      const res = await api.post('/orders', {
        restaurant_id: restaurantId,
        order_type: 'DELIVERY',
        delivery_address: address,
        items: cartEntries.map(([menu_item_id, quantity]) => ({ menu_item_id, quantity })),
      })
      setConfirmation(res.data)
      setCart({})
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not place order.')
    } finally {
      setPlacing(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="text-gray-500">Loading menu...</p>
      </AppLayout>
    )
  }

  const visibleMenu = menu
    .map((c) => ({ ...c, items: (c.items || []).filter((i) => i.is_available) }))
    .filter((c) => c.items.length > 0)

  return (
    <AppLayout>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF2147]">Delivery</p>
          <h1 className="mt-1 font-serif text-4xl text-[#1F3A5F]">Order for delivery</h1>
        </div>
        <Link to="/restaurants" className="text-sm font-semibold text-[#1F3A5F] hover:underline">Dine in instead</Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {visibleMenu.map((category) => (
            <div key={category.id}>
              <h2 className="mb-3 border-b border-gray-200 pb-2 font-serif text-2xl text-[#1F3A5F]">{category.name}</h2>
              <div className="space-y-3">
                {category.items.map((item) => (
                  <div key={item.id} className={`flex items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ${cart[item.id] ? 'ring-[#FF2147]/40' : 'ring-slate-200/70'}`}>
                    <div className="flex-1 pr-4">
                      <p className="font-semibold text-[#1F3A5F]">{item.name}</p>
                      {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                      <p className="mt-1 font-bold text-[#1F3A5F]">${Number(item.price).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.id, -1)} className="h-8 w-8 rounded-full bg-gray-100 font-bold text-[#1F3A5F] transition-colors hover:bg-gray-200">−</button>
                      <span className="w-6 text-center font-semibold">{cart[item.id] || 0}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="h-8 w-8 rounded-full bg-[#FF2147] font-bold text-white transition-colors hover:bg-[#dc1539]">+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-200/70">
            <h2 className="mb-4 text-lg font-bold text-[#1F3A5F]">Your order</h2>

            <label className="mb-1 block text-sm font-medium text-gray-700">Delivery address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Street, city, apartment/unit — or your room number if you're staying with us"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
            />

            {cartEntries.length === 0 ? (
              <p className="text-sm text-gray-400">No items added yet.</p>
            ) : (
              <div className="mb-4 space-y-2">
                {cartEntries.map(([itemId, qty]) => {
                  const item = findMenuItem(itemId)
                  if (!item) return null
                  return (
                    <div key={itemId} className="flex justify-between text-sm">
                      <span className="text-gray-600">{qty} × {item.name}</span>
                      <span className="font-medium text-gray-700">${(Number(item.price) * qty).toFixed(2)}</span>
                    </div>
                  )
                })}
                <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-[#1F3A5F]">
                  <span>Estimated subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            {confirmation && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Order placed! <strong>{confirmation.order_number}</strong><br />
                Total: ${Number(confirmation.total_amount).toFixed(2)}
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full rounded-lg bg-[#FF2147] py-3 font-semibold text-white transition-colors hover:bg-[#dc1539] disabled:opacity-50"
            >
              {placing ? 'Placing order...' : 'Place delivery order'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}