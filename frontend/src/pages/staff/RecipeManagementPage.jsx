import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

export default function RecipeManagementPage() {
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [menu, setMenu] = useState([])
  const [menuItemId, setMenuItemId] = useState('')
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryItemId, setInventoryItemId] = useState('')
  const [quantityRequired, setQuantityRequired] = useState('')
  const [recipe, setRecipe] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/restaurants').then((res) => {
      setRestaurants(res.data)
      if (res.data.length > 0) setRestaurantId(res.data[0].id)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!restaurantId) return
    api.get(`/restaurants/${restaurantId}/menu`).then((res) => setMenu(res.data))
    api.get(`/inventory/restaurant/${restaurantId}`).then((res) => setInventoryItems(res.data))
  }, [restaurantId])

  useEffect(() => {
    if (!menuItemId) {
      setRecipe([])
      return
    }
    loadRecipe()
  }, [menuItemId])

  function loadRecipe() {
    api.get(`/inventory/recipes/menu-item/${menuItemId}`).then((res) => setRecipe(res.data))
  }

  const allMenuItems = menu.flatMap((cat) => cat.items.map((item) => ({ ...item, categoryName: cat.name })))

  async function handleAddIngredient(e) {
    e.preventDefault()
    setError('')
    if (!menuItemId || !inventoryItemId || !quantityRequired) {
      setError('Fill in all fields.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/inventory/recipes', {
        menu_item_id: menuItemId,
        inventory_item_id: inventoryItemId,
        quantity_required: Number(quantityRequired),
      })
      setQuantityRequired('')
      setInventoryItemId('')
      loadRecipe()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not add ingredient.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Recipe Ingredients</h1>
      <p className="text-gray-500 mb-6">Link menu items to the inventory they consume, so orders can auto-deduct stock</p>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-md p-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant</label>
            <select
              value={restaurantId}
              onChange={(e) => { setRestaurantId(e.target.value); setMenuItemId('') }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-navy"
            >
              {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">Menu item</label>
            <select
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="">Select a menu item...</option>
              {allMenuItems.map((item) => (
                <option key={item.id} value={item.id}>{item.categoryName} — {item.name}</option>
              ))}
            </select>

            {menuItemId && (
              <form onSubmit={handleAddIngredient} className="space-y-3 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inventory item</label>
                  <select
                    value={inventoryItemId}
                    onChange={(e) => setInventoryItemId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
                  >
                    <option value="">Select an ingredient...</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity required per order</label>
                  <input
                    type="number" step="0.001" min="0" value={quantityRequired}
                    onChange={(e) => setQuantityRequired(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
                  />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit" disabled={submitting}
                  className="w-full py-2.5 bg-red text-white font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Ingredient'}
                </button>
              </form>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-lg font-bold text-navy mb-4">Current Recipe</h2>
            {!menuItemId && <p className="text-gray-400 text-sm">Select a menu item to see its recipe.</p>}
            {menuItemId && recipe.length === 0 && (
              <p className="text-gray-400 text-sm">No ingredients linked yet — this item won't deduct any stock.</p>
            )}
            <div className="space-y-2">
              {recipe.map((r) => (
                <div key={r.id} className="flex justify-between text-sm py-2 border-b border-gray-50">
                  <span className="text-gray-700">{r.inventory_item_name}</span>
                  <span className="text-gray-500">{r.quantity_required} {r.inventory_item_unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}