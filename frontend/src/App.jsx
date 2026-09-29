import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import api from './services/api'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import HotelsPage from './pages/hotels/HotelsPage'
import HotelRoomsPage from './pages/hotels/HotelRoomsPage'
import HotelBookingCheckoutPage from './pages/customer/HotelBookingCheckoutPage'
import MyBookingsPage from './pages/bookings/MyBookingsPage'
import MyInvoicesPage from './pages/bookings/MyInvoicesPage'
import StaffBookingsPage from './pages/staff/StaffBookingsPage'
import HousekeepingPage from './pages/staff/HousekeepingPage'
import ServiceRequestsPage from './pages/staff/ServiceRequestsPage'
import StaffInvoicesPage from './pages/staff/StaffInvoicesPage'
import AuditLogPage from './pages/staff/AuditLogPage'
import RestaurantsPage from './pages/restaurants/RestaurantsPage'
import RestaurantMenuPage from './pages/restaurants/RestaurantMenuPage'
import MyOrdersPage from './pages/restaurants/MyOrdersPage'
import ReserveTablePage from './pages/restaurants/ReserveTablePage'
import MyReservationsPage from './pages/restaurants/MyReservationsPage'
import MyRestaurantInvoicesPage from './pages/restaurants/MyRestaurantInvoicesPage'
import StaffTablesPage from './pages/staff/StaffTablesPage'
import StaffOrdersPage from './pages/staff/StaffOrdersPage'
import KitchenOrdersPage from './pages/staff/KitchenOrdersPage'
import StaffReservationsPage from './pages/staff/StaffReservationsPage'
import StaffRestaurantInvoicesPage from './pages/staff/StaffRestaurantInvoicesPage'
import StaffDeliveriesPage from './pages/staff/StaffDeliveriesPage'
import MyDeliveriesPage from './pages/staff/MyDeliveriesPage'
import InventoryPage from './pages/staff/InventoryPage'
import RecipeManagementPage from './pages/staff/RecipeManagementPage'
import NotificationPreferencesPage from './pages/staff/NotificationPreferencesPage'
import EmailLogPage from './pages/staff/EmailLogPage'
import DashboardPage from './pages/staff/DashboardPage'
import ReportsPage from './pages/staff/ReportsPage'
import BusinessRulesPage from './pages/staff/BusinessRulesPage'
import SubscribersPage from './pages/staff/SubscribersPage'
import MyAccountPage from './pages/customer/MyAccountPage'
import DeliveryHomePage from './pages/delivery/DeliveryHomePage'
import DeliveryCheckoutPage from './pages/delivery/DeliveryCheckoutPage'
import DeliveryOrdersPage from './pages/delivery/DeliveryOrdersPage'
import DeliveryTrackingPage from './pages/delivery/DeliveryTrackingPage'
import AppLayout from './components/layout/AppLayout'

const SHADOW_REST = 'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.10)]'

function QuickAction({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-navy transition-colors hover:border-navy/30 hover:bg-slate-50"
    >
      {label} →
    </button>
  )
}

function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isCustomer = user?.role === 'CUSTOMER'

  const [loading, setLoading] = useState(isCustomer)
  const [currentStay, setCurrentStay] = useState(null)
  const [activeOrders, setActiveOrders] = useState([])
  const [outstandingInvoices, setOutstandingInvoices] = useState([])

  useEffect(() => {
    if (!isCustomer) return
    Promise.all([
      api.get('/bookings/my'),
      api.get('/orders/my'),
      api.get('/invoices/my'),
      api.get('/restaurant-invoices/my'),
    ])
      .then(([bookings, orders, hotelInvoices, restaurantInvoices]) => {
        const stay = bookings.data.find((b) => b.status === 'CHECKED_IN')
          || bookings.data.find((b) => b.status === 'CONFIRMED')
          || null
        setCurrentStay(stay)

        const active = orders.data.filter((o) => !['SERVED', 'CANCELLED'].includes(o.status))
        setActiveOrders(active.slice(0, 3))

        const unpaid = [
          ...hotelInvoices.data.filter((i) => i.status !== 'PAID').map((i) => ({ ...i, kind: 'Hotel' })),
          ...restaurantInvoices.data.filter((i) => i.status !== 'PAID').map((i) => ({ ...i, kind: 'Restaurant' })),
        ]
        setOutstandingInvoices(unpaid)
      })
      .finally(() => setLoading(false))
  }, [isCustomer])

  // Browsing is open to everyone; only committing to a booking or an order
  // needs an account. A signed-out visitor landing on "/" goes straight to
  // the hotel, not to a login wall.
  if (!user) return <Navigate to="/hotels" replace />

  if (!isCustomer) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold text-navy mb-2">Welcome, {user?.first_name}</h1>
          <p className="text-gray-500 mb-8">Role: {user?.role}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => navigate('/hotels')} className="px-8 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-navy-dark transition-colors">Browse Hotels</button>
            <button onClick={() => navigate('/restaurants')} className="px-8 py-3 bg-red text-white font-semibold rounded-lg hover:bg-red-dark transition-colors">Dine With Us</button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const totalOutstanding = outstandingInvoices.reduce((sum, i) => sum + Number(i.total_amount - (i.amount_paid || 0)), 0)

  return (
    <AppLayout>
      <header className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-8 overflow-hidden bg-gradient-to-br from-[#1F3A5F] to-[#132840]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="relative px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-[40px]">
            Welcome back, {user?.first_name}
          </h1>
          <p className="mt-2 max-w-xl text-[14px] font-normal leading-6 text-white/50">
            Here's what's happening with your stays and orders right now.
          </p>
        </div>
      </header>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && (
        <div className="space-y-6">
          {currentStay && (
            <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 ${SHADOW_REST}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
                {currentStay.status === 'CHECKED_IN' ? 'Current Stay' : 'Upcoming Booking'}
              </p>
              <p className="text-lg font-bold text-navy">{currentStay.booking_reference}</p>
              <p className="text-sm text-slate-500">
                {currentStay.check_in_date} → {currentStay.check_out_date} · {currentStay.number_of_guests} guest(s)
              </p>
            </div>
          )}

          {activeOrders.length > 0 && (
            <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 ${SHADOW_REST}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Active Orders</p>
              <div className="space-y-2">
                {activeOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    {o.order_type === 'DELIVERY' ? (
                      <button type="button" onClick={() => navigate(`/delivery/orders/${o.id}`)} className="font-medium text-navy underline-offset-4 hover:underline">
                        {o.order_number} · Track
                      </button>
                    ) : (
                      <span className="font-medium text-navy">{o.order_number}</span>
                    )}
                    <span className="text-slate-500">{o.status.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outstandingInvoices.length > 0 && (
            <div className={`rounded-2xl border border-amber-200 bg-amber-50/60 p-5`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-700 mb-2">Outstanding Payment</p>
              <p className="text-lg font-bold text-navy">${totalOutstanding.toFixed(2)}</p>
              <p className="text-sm text-slate-500">{outstandingInvoices.length} invoice(s) awaiting payment</p>
            </div>
          )}

          {!currentStay && activeOrders.length === 0 && outstandingInvoices.length === 0 && (
            <div className={`rounded-2xl border border-slate-200/80 bg-white p-8 text-center ${SHADOW_REST}`}>
              <p className="text-sm text-slate-400">Nothing needs your attention right now.</p>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Quick Actions</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickAction label="Browse Hotels" onClick={() => navigate('/hotels')} />
              <QuickAction label="Dine With Us" onClick={() => navigate('/restaurants')} />
              <QuickAction label="Order Delivery" onClick={() => navigate('/delivery')} />
              <QuickAction label="My Account" onClick={() => navigate('/my-account')} />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-navy mb-2">Access Restricted</h2>
          <p className="text-gray-500">You don't have permission to view this page.</p>
        </div>
      </AppLayout>
    )
  }
  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/hotels" element={<HotelsPage />} />
      <Route path="/hotels/:hotelId" element={<HotelRoomsPage />} />
      <Route
        path="/hotels/:hotelId/booking/checkout"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <HotelBookingCheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
      <Route path="/my-invoices" element={<ProtectedRoute><MyInvoicesPage /></ProtectedRoute>} />
      <Route path="/restaurants" element={<RestaurantsPage />} />
      <Route path="/restaurants/:restaurantId" element={<RestaurantMenuPage />} />
      {/* Legacy delivery URL — everything delivery now lives under /delivery. */}
      <Route path="/restaurants/:restaurantId/delivery" element={<Navigate to="/delivery" replace />} />
      <Route path="/restaurants/:restaurantId/reserve" element={<ReserveTablePage />} />

      <Route path="/delivery" element={<DeliveryHomePage />} />
      {/* Checkout still requires an account — ProtectedRoute already passes
          the current path as `from`, so signing in returns the guest here
          with their basket intact. */}
      <Route
        path="/delivery/checkout"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <DeliveryCheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/delivery/orders"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <DeliveryOrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/delivery/orders/:orderId"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <DeliveryTrackingPage />
          </ProtectedRoute>
        }
      />

      <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
      <Route path="/my-reservations" element={<ProtectedRoute><MyReservationsPage /></ProtectedRoute>} />
      <Route path="/my-restaurant-invoices" element={<ProtectedRoute><MyRestaurantInvoicesPage /></ProtectedRoute>} />
      <Route path="/my-account" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><MyAccountPage /></ProtectedRoute>} />
      <Route path="/staff/bookings" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST']}><StaffBookingsPage /></ProtectedRoute>} />
      <Route path="/staff/housekeeping" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'HOUSEKEEPING']}><HousekeepingPage /></ProtectedRoute>} />
      <Route path="/staff/service-requests" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING']}><ServiceRequestsPage /></ProtectedRoute>} />
      <Route path="/staff/invoices" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST']}><StaffInvoicesPage /></ProtectedRoute>} />
      <Route path="/staff/audit-log" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER']}><AuditLogPage /></ProtectedRoute>} />
      <Route path="/staff/tables" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'WAITER']}><StaffTablesPage /></ProtectedRoute>} />
      <Route path="/staff/orders" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'WAITER']}><StaffOrdersPage /></ProtectedRoute>} />
      <Route path="/staff/kitchen" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'KITCHEN']}><KitchenOrdersPage /></ProtectedRoute>} />
      <Route path="/staff/reservations" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'WAITER']}><StaffReservationsPage /></ProtectedRoute>} />
      <Route path="/staff/restaurant-invoices" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'WAITER']}><StaffRestaurantInvoicesPage /></ProtectedRoute>} />
      <Route path="/staff/deliveries" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'WAITER']}><StaffDeliveriesPage /></ProtectedRoute>} />
      <Route path="/my-deliveries" element={<ProtectedRoute allowedRoles={['DELIVERY']}><MyDeliveriesPage /></ProtectedRoute>} />
      <Route
        path="/staff/inventory"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'KITCHEN', 'WAITER']}>
            <InventoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/recipes"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER']}>
            <RecipeManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/notification-preferences"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'KITCHEN', 'WAITER', 'DELIVERY']}>
            <NotificationPreferencesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/email-log"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <EmailLogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/dashboard"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/reports"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER']}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/business-rules"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER']}>
            <BusinessRulesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/subscribers"
        element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MANAGER']}>
            <SubscribersPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App