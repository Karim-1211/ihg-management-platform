import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import HotelsPage from './pages/hotels/HotelsPage'
import HotelRoomsPage from './pages/hotels/HotelRoomsPage'
import MyBookingsPage from './pages/bookings/MyBookingsPage'
import MyInvoicesPage from './pages/bookings/MyInvoicesPage'
import StaffBookingsPage from './pages/staff/StaffBookingsPage'
import HousekeepingPage from './pages/staff/HousekeepingPage'
import ServiceRequestsPage from './pages/staff/ServiceRequestsPage'
import StaffInvoicesPage from './pages/staff/StaffInvoicesPage'
import AuditLogPage from './pages/staff/AuditLogPage'
import RestaurantsPage from './pages/restaurants/RestaurantsPage'
import RestaurantMenuPage from './pages/restaurants/RestaurantMenuPage'
import DeliveryOrderPage from './pages/restaurants/DeliveryOrderPage'
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
import MyAccountPage from './pages/customer/MyAccountPage'
import AppLayout from './components/layout/AppLayout'

function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
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

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
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
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/hotels" element={<ProtectedRoute><HotelsPage /></ProtectedRoute>} />
      <Route path="/hotels/:hotelId" element={<ProtectedRoute><HotelRoomsPage /></ProtectedRoute>} />
      <Route path="/my-bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
      <Route path="/my-invoices" element={<ProtectedRoute><MyInvoicesPage /></ProtectedRoute>} />
      <Route path="/restaurants" element={<ProtectedRoute><RestaurantsPage /></ProtectedRoute>} />
      <Route path="/restaurants/:restaurantId" element={<ProtectedRoute><RestaurantMenuPage /></ProtectedRoute>} />
      <Route path="/restaurants/:restaurantId/delivery" element={<ProtectedRoute><DeliveryOrderPage /></ProtectedRoute>} />
      <Route path="/restaurants/:restaurantId/reserve" element={<ProtectedRoute><ReserveTablePage /></ProtectedRoute>} />
      <Route path="/my-orders" element={<ProtectedRoute><MyOrdersPage /></ProtectedRoute>} />
      <Route path="/my-reservations" element={<ProtectedRoute><MyReservationsPage /></ProtectedRoute>} />
      <Route path="/my-restaurant-invoices" element={<ProtectedRoute><MyRestaurantInvoicesPage /></ProtectedRoute>} />
      <Route path="/my-account" element={<ProtectedRoute><MyAccountPage /></ProtectedRoute>} />
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
    </Routes>
  )
}

export default App