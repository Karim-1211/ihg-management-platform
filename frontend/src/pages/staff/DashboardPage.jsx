import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/AppLayout'

const ATTENTION_ROUTES = {
  service_request: '/staff/service-requests',
  failed_payment: '/staff/invoices',
  low_stock: '/staff/inventory',
}

const ATTENTION_ICONS = {
  service_request: '🟠',
  failed_payment: '🔴',
  low_stock: '🔴',
}

function KpiCard({ label, value, subtext }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-navy">{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  )
}

function SectionCard({ title, applicable, notApplicableText, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6">
      <h2 className="text-lg font-bold text-navy mb-4">{title}</h2>
      {applicable ? children : (
        <p className="text-sm text-gray-400">{notApplicableText}</p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadOverview()
  }, [])

  function loadOverview() {
    setLoading(true)
    setError('')
    api.get('/dashboard/overview')
      .then((res) => setOverview(res.data))
      .catch(() => setError('Could not load dashboard data.'))
      .finally(() => setLoading(false))
  }

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Management Dashboard</h1>
        <p className="text-gray-500">Good day, {user?.first_name} · {todayLabel}</p>
      </div>

      {loading && <p className="text-gray-500">Loading dashboard...</p>}

      {error && (
        <div className="bg-white rounded-2xl shadow-md p-6 mb-6">
          <p className="text-red-600 text-sm mb-3">{error}</p>
          <button
            onClick={loadOverview}
            className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-dark transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && overview && (
        <div className="space-y-6">
          {/* Business Health */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Occupancy"
              value={overview.hotel.applicable && overview.hotel.current_occupancy_percent !== null
                ? `${overview.hotel.current_occupancy_percent}%`
                : '—'}
              subtext={overview.hotel.applicable ? 'Currently checked in' : 'No hotel in scope'}
            />
            <KpiCard
              label="Orders Today"
              value={overview.restaurant.orders_today.total}
              subtext={`Dine-in ${overview.restaurant.orders_today.dine_in} · Delivery ${overview.restaurant.orders_today.delivery}`}
            />
            <KpiCard
              label="Revenue Today"
              value={`$${overview.financial.revenue_today.toFixed(2)}`}
              subtext="Completed payments only"
            />
            <KpiCard
              label="Active Deliveries"
              value={overview.delivery.active_deliveries}
              subtext="Not yet delivered"
            />
          </div>

          {/* Attention Required */}
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-navy">⚠ Attention Required</h2>
            </div>
            {overview.attention.length === 0 ? (
              <p className="px-6 py-6 text-sm text-gray-400">Nothing needs your attention right now.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {overview.attention.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      const route = ATTENTION_ROUTES[item.category]
                      if (route) navigate(route)
                    }}
                    className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span>{ATTENTION_ICONS[item.category] || '•'}</span>
                      <p className="text-sm text-navy font-medium">{item.label}</p>
                    </div>
                    <span className="text-sm text-red font-semibold">View →</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Domain panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard
              title="Hotel Operations"
              applicable={overview.hotel.applicable}
              notApplicableText="No hotel operations in your scope."
            >
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Current Occupancy</span>
                  <span className="font-semibold text-navy">
                    {overview.hotel.current_occupancy_percent !== null ? `${overview.hotel.current_occupancy_percent}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Check-ins Today</span>
                  <span className="font-semibold text-navy">{overview.hotel.check_ins_today}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Check-outs Today</span>
                  <span className="font-semibold text-navy">{overview.hotel.check_outs_today}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Restaurant Operations"
              applicable={overview.restaurant.applicable}
              notApplicableText="No restaurant operations in your scope."
            >
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Orders Today</span>
                  <span className="font-semibold text-navy">{overview.restaurant.orders_today.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Dine-In</span>
                  <span className="font-semibold text-navy">{overview.restaurant.orders_today.dine_in}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Room Service</span>
                  <span className="font-semibold text-navy">{overview.restaurant.orders_today.room_service}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Delivery</span>
                  <span className="font-semibold text-navy">{overview.restaurant.orders_today.delivery}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Delivery Operations"
              applicable={overview.delivery.applicable}
              notApplicableText="No delivery operations in your scope."
            >
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Active Deliveries</span>
                <span className="font-semibold text-navy">{overview.delivery.active_deliveries}</span>
              </div>
            </SectionCard>

            <SectionCard
              title="Inventory Health"
              applicable={overview.inventory.applicable}
              notApplicableText="No inventory in your scope."
            >
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Low Stock Items</span>
                <span className={`font-semibold ${overview.inventory.low_stock_count > 0 ? 'text-red' : 'text-navy'}`}>
                  {overview.inventory.low_stock_count}
                </span>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </AppLayout>
  )
}