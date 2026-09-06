import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function DeliveryOrderPage() {
  const { restaurantId } = useParams()
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
      const found = category.items.find((i) => i.id === itemId)
      if (found) return found
    }
    return null
  }

  const cartEntries = Object.entries(cart)
  const cartTotal = cartEntries.reduce((sum, [itemId, qty]) => {
    const item = findMenuItem(itemId)
    return sum + (item ? item.price * qty : 0)
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

  return (
    <AppLayout>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-2xl font-bold text-navy">Order for Delivery</h1>
        <Link to={`/restaurants/${restaurantId}`} className="text-sm text-navy hover:underline">
          Dine in instead
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {menu.map((category) => (
            <div key={category.id}>
              <h2 className="text-lg font-bold text-navy mb-3 border-b border-gray-200 pb-2">
                {category.name}
              </h2>
              <div className="space-y-3">
                {category.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4">
                    <div className="flex-1">
                      <p className="font-semibold text-navy">{item.name}</p>
                      {item.description && <p className="text-gray-500 text-sm">{item.description}</p>}
                      <p className="text-navy font-bold mt-1">${item.price}</p>
                    </div>
                    {item.is_available && (
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-full bg-gray-100 text-navy font-bold hover:bg-gray-200 transition-colors">−</button>
                        <span className="w-6 text-center font-semibold">{cart[item.id] || 0}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-full bg-red text-white font-bold hover:bg-red-dark transition-colors">+</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-md p-6 sticky top-6">
            <h2 className="text-lg font-bold text-navy mb-4">Your Order</h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Street, city, apartment/unit..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-navy"
            />

            {cartEntries.length === 0 ? (
              <p className="text-gray-400 text-sm">No items added yet.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {cartEntries.map(([itemId, qty]) => {
                  const item = findMenuItem(itemId)
                  if (!item) return null
                  return (
                    <div key={itemId} className="flex justify-between text-sm">
                      <span className="text-gray-600">{qty} × {item.name}</span>
                      <span className="text-gray-700 font-medium">${(item.price * qty).toFixed(2)}</span>
                    </div>
                  )
                })}
                <div className="flex justify-between font-bold text-navy pt-2 border-t border-gray-100">
                  <span>Estimated Subtotal</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}

            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            {confirmation && (
              <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg">
                Order placed! <strong>{confirmation.order_number}</strong><br />
                Total: ${confirmation.total_amount}
              </div>
            )}

            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full py-2.5 bg-red text-white font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
            >
              {placing ? 'Placing order...' : 'Place Delivery Order'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}