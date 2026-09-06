import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const TRANSACTION_TYPES = [
  { value: 'PURCHASE', label: 'Purchase (add stock)' },
  { value: 'RETURN', label: 'Return (add stock)' },
  { value: 'WASTE', label: 'Waste (remove stock)' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment (remove stock)' },
  { value: 'SERVICE_USAGE', label: 'Service Usage (remove stock)' },
]

function AdjustStockForm({ item, onDone }) {
  const [type, setType] = useState('PURCHASE')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!quantity || Number(quantity) <= 0) {
      setError('Enter a quantity greater than 0.')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/inventory/items/${item.id}/transactions`, {
        transaction_type: type,
        quantity: Number(quantity),
        notes: notes || null,
      })
      setQuantity('')
      setNotes('')
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record transaction.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <select
          value={type} onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Quantity ({item.unit})</label>
        <input
          type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
        <input
          value={notes} onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        />
      </div>
      <button
        type="submit" disabled={submitting}
        className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Record'}
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </form>
  )
}

function ItemHistory({ item }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    api.get(`/inventory/items/${item.id}/transactions`).then((res) => setHistory(res.data))
  }, [item.id])

  if (!history) return <p className="text-xs text-gray-400 mt-3">Loading history...</p>
  if (history.length === 0) return <p className="text-xs text-gray-400 mt-3">No transactions yet.</p>

  return (
    <div className="mt-3 space-y-1.5 text-xs">
      {history.map((h) => (
        <div key={h.id} className="flex justify-between text-gray-600">
          <span>
            <span className="font-semibold">{h.transaction_type.replace(/_/g, ' ')}</span>
            {h.notes ? ` — ${h.notes}` : ''}
          </span>
          <span>{h.quantity_before} → {h.quantity_after} {item.unit}</span>
        </div>
      ))}
    </div>
  )
}

function CreateItemForm({ scopeType, scopeId, onDone }) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState('')
  const [minimum, setMinimum] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.post('/inventory/items', {
        [scopeType === 'hotel' ? 'hotel_id' : 'restaurant_id']: scopeId,
        name,
        unit,
        current_quantity: Number(quantity) || 0,
        minimum_quantity: Number(minimum) || 0,
      })
      setName('')
      setUnit('')
      setQuantity('')
      setMinimum('')
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create item.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-5 mb-6 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Item name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Unit (kg, pcs, L...)</label>
        <input value={unit} onChange={(e) => setUnit(e.target.value)} required
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Starting qty</label>
        <input type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Low-stock threshold</label>
        <input type="number" step="0.001" min="0" value={minimum} onChange={(e) => setMinimum(e.target.value)}
          className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
      </div>
      <button type="submit" disabled={submitting}
        className="px-4 py-2 bg-red text-white text-sm font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50">
        {submitting ? 'Adding...' : 'Add Item'}
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </form>
  )
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [scopeType, setScopeType] = useState('restaurant')
  const [scopeOptions, setScopeOptions] = useState([])
  const [scopeId, setScopeId] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [error, setError] = useState('')

  const isFlexibleRole = ['SUPER_ADMIN', 'MANAGER'].includes(user?.role)
  const isHotelScoped = ['RECEPTIONIST', 'HOUSEKEEPING'].includes(user?.role)
  const isRestaurantScoped = ['KITCHEN', 'WAITER'].includes(user?.role)

  useEffect(() => {
    if (isHotelScoped) {
      setScopeType('hotel')
      setScopeId(user.hotel_id || '')
      setLoading(false)
    } else if (isRestaurantScoped) {
      setScopeType('restaurant')
      setScopeId(user.restaurant_id || '')
      setLoading(false)
    } else if (isFlexibleRole) {
      api.get('/restaurants').then((res) => {
        setScopeOptions(res.data)
        if (res.data.length > 0) setScopeId(res.data[0].id)
        setLoading(false)
      })
    }
  }, [user])

  useEffect(() => {
    if (!scopeId) return
    loadItems()
  }, [scopeId, scopeType])

  function loadItems() {
    const url = scopeType === 'hotel' ? `/inventory/hotel/${scopeId}` : `/inventory/restaurant/${scopeId}`
    api.get(url).then((res) => setItems(res.data)).catch(() => setError('Could not load inventory.'))
  }

  async function handleScopeTypeSwitch(newType) {
    setScopeType(newType)
    setScopeId('')
    setItems([])
    if (newType === 'restaurant') {
      const res = await api.get('/restaurants')
      setScopeOptions(res.data)
      if (res.data.length > 0) setScopeId(res.data[0].id)
    } else {
      const res = await api.get('/hotels')
      setScopeOptions(res.data)
      if (res.data.length > 0) setScopeId(res.data[0].id)
    }
  }

  if (!isFlexibleRole && !scopeId) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-navy mb-2">Not Assigned</h2>
          <p className="text-gray-500">Your account isn't assigned to a hotel or restaurant yet.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Inventory</h1>
      <p className="text-gray-500 mb-6">Track stock levels and record purchases, waste, and usage</p>

      {isFlexibleRole && (
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
            <select
              value={scopeType}
              onChange={(e) => handleScopeTypeSwitch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              <option value="restaurant">Restaurant</option>
              <option value="hotel">Hotel</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {scopeType === 'hotel' ? 'Hotel' : 'Restaurant'}
            </label>
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy min-w-[200px]"
            >
              {scopeOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isFlexibleRole && scopeId && (
        <CreateItemForm scopeType={scopeType} scopeId={scopeId} onDone={loadItems} />
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && items.length === 0 && <p className="text-gray-500">No inventory items yet.</p>}

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-bold text-navy">{item.name}</p>
                <p className="text-gray-500 text-sm">
                  {item.current_quantity} {item.unit} in stock · minimum {item.minimum_quantity} {item.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.is_low_stock && (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                    LOW STOCK
                  </span>
                )}
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="px-3 py-1.5 bg-gray-100 text-navy text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {expandedId === item.id ? 'Close' : 'Manage'}
                </button>
              </div>
            </div>

            {expandedId === item.id && (
              <>
                <AdjustStockForm item={item} onDone={loadItems} />
                <ItemHistory item={item} />
              </>
            )}
          </div>
        ))}
      </div>
    </AppLayout>
  )
}