import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../notifications/NotificationBell'

function IconHotel() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V9l6 3v9M8 9h.01M8 13h.01M8 17h.01" />
    </svg>
  )
}

function IconRestaurant() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v18M4 8h4M4 13h4M17 3v18M14 8h6M17 3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3" />
    </svg>
  )
}

function IconDelivery() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h11v9H3zM14 10h4l3 3v2h-4M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  )
}

function IconManagement() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V9M10 19V5M16 19v-7M22 19H2M7 9h.01M13 5h.01M19 12h.01" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3M7 8l-4 4 4 4M13 5V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-1" />
    </svg>
  )
}

function NavGroup({ icon, label, items, currentPath }) {
  if (items.length === 0) {
    return null
  }

  const activeGroup = items.some((item) => currentPath === item.to)

  return (
    <div className="mb-7">
      <div
        className={`
          flex items-center gap-2.5 px-3 mb-2
          text-[11px] font-bold uppercase tracking-[0.14em]
          ${activeGroup ? 'text-white/80' : 'text-white/40'}
        `}
      >
        <span className={activeGroup ? 'text-red' : 'text-white/40'}>
          {icon}
        </span>
        <span>{label}</span>
      </div>

      <div className="space-y-1">
        {items.map((item) => {
          const active = currentPath === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`
                group flex items-center justify-between
                px-3 py-2.5 rounded-xl
                text-sm transition-all duration-200
                ${
                  active
                    ? 'bg-red text-white font-semibold shadow-sm'
                    : 'text-white/65 hover:bg-white/[0.07] hover:text-white'
                }
              `}
            >
              <span>{item.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function Sidebar({ mobileOpen = false, onClose = () => {} }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const role = user?.role

  function handleLogout() {
    logout()
  }

  const hotelItems = []
  const restaurantItems = []
  const deliveryItems = []
  const managementItems = []

  if (['SUPER_ADMIN', 'MANAGER'].includes(role)) {
    managementItems.push({ to: '/staff/dashboard', label: 'Dashboard' })
    managementItems.push({ to: '/staff/reports', label: 'Reports' })
    managementItems.push({ to: '/staff/business-rules', label: 'Business Rules' })
  }

  if (['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(role)) {
    hotelItems.push({ to: '/staff/bookings', label: 'Bookings' })
  }
  if (['SUPER_ADMIN', 'MANAGER', 'HOUSEKEEPING'].includes(role)) {
    hotelItems.push({ to: '/staff/housekeeping', label: 'Housekeeping' })
  }
  if (['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING'].includes(role)) {
    hotelItems.push({ to: '/staff/service-requests', label: 'Service Requests' })
  }
  if (['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(role)) {
    hotelItems.push({ to: '/staff/invoices', label: 'Invoices' })
  }

  if (['SUPER_ADMIN', 'MANAGER', 'WAITER'].includes(role)) {
    restaurantItems.push(
      { to: '/staff/tables', label: 'Tables' },
      { to: '/staff/orders', label: 'Orders' },
      { to: '/staff/reservations', label: 'Reservations' },
      { to: '/staff/restaurant-invoices', label: 'Bills' },
    )
  }
  if (['SUPER_ADMIN', 'MANAGER', 'KITCHEN'].includes(role)) {
    restaurantItems.push({ to: '/staff/kitchen', label: 'Kitchen' })
  }

  if (['SUPER_ADMIN', 'MANAGER', 'WAITER'].includes(role)) {
    deliveryItems.push({ to: '/staff/deliveries', label: 'Deliveries' })
  }
  if (role === 'DELIVERY') {
    deliveryItems.push({ to: '/my-deliveries', label: 'My Deliveries' })
  }

  if (['SUPER_ADMIN', 'MANAGER'].includes(role)) {
    managementItems.push({ to: '/staff/audit-log', label: 'Audit Log' })
    managementItems.push({ to: '/staff/inventory', label: 'Inventory' })
    managementItems.push({ to: '/staff/recipes', label: 'Recipes' })
    managementItems.push({ to: '/staff/notification-preferences', label: 'Notification Settings' })
    managementItems.push({ to: '/staff/subscribers', label: 'Newsletter' })
  }
  if (['RECEPTIONIST', 'HOUSEKEEPING', 'KITCHEN', 'WAITER'].includes(role)) {
    managementItems.push({ to: '/staff/inventory', label: 'Inventory' })
    managementItems.push({ to: '/staff/notification-preferences', label: 'Notification Settings' })
  }
  if (role === 'DELIVERY') {
    managementItems.push({ to: '/staff/notification-preferences', label: 'Notification Settings' })
  }
  if (role === 'SUPER_ADMIN') {
    managementItems.push({ to: '/staff/email-log', label: 'Email Log' })
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="lg:hidden fixed inset-0 bg-black/40 z-40 cursor-default"
        />
      )}

      <aside
        className={`
          fixed
          top-0 left-0
          z-50 lg:z-30
          w-64
          h-screen
          bg-navy
          flex flex-col
          shrink-0
          transform transition-transform duration-300 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="h-[72px] px-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <Link to="/" onClick={onClose} className="flex items-center gap-3">
            <span className="text-2xl font-extrabold tracking-tight text-white">IHG</span>
            <span className="h-5 w-px bg-white/20" />
            <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-white/40">
              Management
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <NotificationBell variant="dark" />

            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="flex-1 px-3 py-6 overflow-y-auto scrollbar-thin">
          <NavGroup icon={<IconManagement />} label="Management" items={managementItems} currentPath={location.pathname} />
          <NavGroup icon={<IconHotel />} label="Hotel" items={hotelItems} currentPath={location.pathname} />
          <NavGroup icon={<IconRestaurant />} label="Restaurant" items={restaurantItems} currentPath={location.pathname} />
          <NavGroup icon={<IconDelivery />} label="Delivery" items={deliveryItems} currentPath={location.pathname} />
        </nav>

        <div className="px-3 py-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-3">
            <span className="w-10 h-10 rounded-xl bg-red flex items-center justify-center text-sm font-bold text-white shrink-0">
              {user?.first_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-[11px] text-white/40 truncate mt-0.5">{role}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="
              w-full flex items-center justify-between
              px-3 py-2.5 rounded-xl
              text-sm font-medium
              text-white/60
              hover:text-white
              hover:bg-white/[0.07]
              transition-colors
            "
          >
            <span>Sign out</span>
            <IconLogout />
          </button>
        </div>
      </aside>
    </>
  )
}