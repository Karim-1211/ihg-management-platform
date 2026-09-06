import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  UNPAID: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
}

function InvoiceCard({ invoice, onPaid }) {
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    setPaying(true)
    setError('')
    try {
      await api.post(`/restaurant-invoices/${invoice.id}/pay`, { payment_method: 'DEMO' })
      onPaid()
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="font-bold text-navy text-lg">{invoice.invoice_number}</p>
          <p className="text-gray-500 text-sm">
            {invoice.order_number} {invoice.table_number ? `· Table ${invoice.table_number}` : ''}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[invoice.status]}`}>
          {invoice.status}
        </span>
      </div>

      <div className="space-y-1.5 text-sm text-gray-600 border-t border-gray-100 pt-4">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${invoice.subtotal}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>${invoice.tax_amount}</span>
        </div>
        {invoice.discount_amount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Discount</span>
            <span>-${invoice.discount_amount}</span>
          </div>
        )}
        <div className="flex justify-between text-navy font-bold text-base pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>${invoice.total_amount}</span>
        </div>
      </div>

      {error && <p className="text-red-600 text-xs mt-3">{error}</p>}

      {invoice.status === 'UNPAID' && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full mt-4 py-2.5 bg-red text-white font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
        >
          {paying ? 'Processing...' : 'Pay Now (Demo)'}
        </button>
      )}
    </div>
  )
}

export default function MyRestaurantInvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  function loadInvoices() {
    setLoading(true)
    api.get('/restaurant-invoices/my').then((res) => setInvoices(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">My Restaurant Bills</h1>
      <p className="text-gray-500 mb-6">Bills are generated automatically once your order is served</p>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && invoices.length === 0 && <p className="text-gray-500">No bills yet.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {invoices.map((inv) => (
          <InvoiceCard key={inv.id} invoice={inv} onPaid={loadInvoices} />
        ))}
      </div>
    </AppLayout>
  )
}