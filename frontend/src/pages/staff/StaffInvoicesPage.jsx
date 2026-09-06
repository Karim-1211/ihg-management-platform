import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_COLORS = {
  UNPAID: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
}

export default function StaffInvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/invoices').then((res) => setInvoices(res.data)).finally(() => setLoading(false))
  }, [])

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">All Invoices</h1>
      <p className="text-gray-500 mb-6">Guest billing across all bookings</p>

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && invoices.length === 0 && <p className="text-gray-500">No invoices yet.</p>}

      <div className="sm:hidden space-y-4">
        {invoices.map((inv) => (
          <div key={inv.id} className="bg-white rounded-2xl shadow-md p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-navy">{inv.invoice_number}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status]}`}>
                {inv.status}
              </span>
            </div>
            <p className="text-gray-600 text-sm">Room {inv.room_number} · {inv.booking_reference}</p>
            <p className="text-navy font-bold mt-2">${inv.total_amount}</p>
          </div>
        ))}
      </div>

      <div className="hidden sm:block bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-5 py-3">Invoice #</th>
                <th className="text-left px-5 py-3">Booking</th>
                <th className="text-left px-5 py-3">Room</th>
                <th className="text-left px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-5 py-4 font-medium text-navy">{inv.invoice_number}</td>
                  <td className="px-5 py-4 text-gray-600">{inv.booking_reference}</td>
                  <td className="px-5 py-4 text-gray-600">{inv.room_number}</td>
                  <td className="px-5 py-4 text-gray-600">${inv.total_amount}</td>
                  <td className="px-5 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}