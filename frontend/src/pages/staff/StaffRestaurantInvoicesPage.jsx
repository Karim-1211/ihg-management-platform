import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  UNPAID: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
}

export default function StaffRestaurantInvoicesPage() {
  const { user } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [restaurantId, setRestaurantId] = useState('')
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const [error, setError] = useState('')

  const isScopedStaff = user?.role === 'WAITER'

  useEffect(() => {
    if (isScopedStaff) {
      setRestaurantId(user.restaurant_id || '')
      setLoading(false)
    } else {
      api.get('/restaurants').then((res) => {
        setRestaurants(res.data)
        if (res.data.length > 0) setRestaurantId(res.data[0].id)
        setLoading(false)
      })
    }
  }, [])

  useEffect(() => {
    if (!restaurantId) return
    loadInvoices()
  }, [restaurantId])

  function loadInvoices() {
    api.get(`/restaurant-invoices/restaurant/${restaurantId}`).then((res) => setInvoices(res.data))
  }

  async function handlePay(invoiceId) {
    setError('')
    setPayingId(invoiceId)
    try {
      await api.post(`/restaurant-invoices/${invoiceId}/pay`, { payment_method: 'DEMO' })
      loadInvoices()
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed.')
    } finally {
      setPayingId(null)
    }
  }

  if (isScopedStaff && !user.restaurant_id) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-navy mb-2">Not Assigned</h2>
          <p className="text-gray-500">Your account isn't assigned to a restaurant yet. Contact your manager.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Restaurant Bills</h1>
      <p className="text-gray-500 mb-6">Settle bills for served orders</p>

      {!isScopedStaff && (
        <select
          value={restaurantId}
          onChange={(e) => setRestaurantId(e.target.value)}
          className="mb-6 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy"
        >
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && invoices.length === 0 && <p className="text-gray-500">No bills yet.</p>}

      <div className="space-y-4">
        {invoices.map((inv) => (
          <div key={inv.id} className="bg-white rounded-2xl shadow-md p-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-bold text-navy">{inv.invoice_number}</p>
              <p className="text-gray-500 text-sm">
                {inv.order_number} {inv.table_number ? `· Table ${inv.table_number}` : ''} · ${inv.total_amount}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status]}`}>
                {inv.status}
              </span>
              {inv.status === 'UNPAID' && (
                <button
                  onClick={() => handlePay(inv.id)}
                  disabled={payingId === inv.id}
                  className="px-4 py-1.5 bg-navy text-white text-xs font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50"
                >
                  {payingId === inv.id ? 'Processing...' : 'Mark Paid'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  )
}