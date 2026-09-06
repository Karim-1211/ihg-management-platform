import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function RestaurantMenuPage() {
  const { restaurantId } = useParams()
  const [menu, setMenu] = useState([])
  const [tables, setTables] = useState([])
  const [selectedTableId, setSelectedTableId] = useState('')
  const [cart, setCart] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [placing, setPlacing] = useState(false)
  const [confirmation, setConfirmation] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/restaurants/${restaurantId}/menu`),
      api.get(`/restaurants/${restaurantId}/tables`),
    ])
      .then(([menuRes, tablesRes]) => {
        setMenu(menuRes.data)
        setTables(tablesRes.data)
      })
      .catch(() => setError('Could not load restaurant details.'))
      .finally(() => setLoading(false))
  }, [restaurantId])

  function updateQuantity(itemId, delta) {
    setCart((prev) => {
      const current = prev[itemId] || 0
      const next = Math.max(0, current + delta)
      const updated = { ...prev }
      if (next === 0) {
        delete updated[itemId]
      } else {
        updated[itemId] = next
      }
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
    if (!selectedTableId) {
      setError('Please select a table.')
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
        order_type: 'DINE_IN',
        table_id: selectedTableId,
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
        <h1 className="text-2xl font-bold text-navy">Menu</h1>
        <div className="flex gap-3">
          <Link
            to={`/restaurants/${restaurantId}/reserve`}
            className="px-5 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-dark transition-colors"
          >
            Reserve a Table
          </Link>
          <Link
            to={`/restaurants/${restaurantId}/delivery`}
            className="px-5 py-2 bg-red text-white text-sm font-semibold rounded-lg hover:bg-red-dark transition-colors"
          >
            Order for Delivery
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Menu */}
        <div className="lg:col-span-2 space-y-8">
          {menu.length === 0 && <p className="text-gray-500">No menu items available yet.</p>}
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
                      {!item.is_available && (
                        <span className="text-xs text-red-500 font-medium">Currently unavailable</span>
                      )}
                    </div>
                    {item.is_available && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-full bg-gray-100 text-navy font-bold hover:bg-gray-200 transition-colors"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-semibold">{cart[item.id] || 0}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-full bg-red text-white font-bold hover:bg-red-dark transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-md p-6 sticky top-6">
            <h2 className="text-lg font-bold text-navy mb-4">Your Order</h2>

            <label className="block text-sm font-medium text-gray-700 mb-1">Table</label>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="">Select a table...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id} disabled={t.status !== 'AVAILABLE'}>
                  Table {t.table_number} ({t.capacity} seats) {t.status !== 'AVAILABLE' ? `— ${t.status}` : ''}
                </option>
              ))}
            </select>

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
                <p className="text-xs text-gray-400">Final total (with tax) confirmed after placing order.</p>
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
              {placing ? 'Placing order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}