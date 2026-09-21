import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../notifications/NotificationBell'

function ChevronIcon({ open = false }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${
        open ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m6 9 6 6 6-6"
      />
    </svg>
  )
}

function HotelIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M5 21V7l8-4v18M13 21V9l6 3v9M8 9h.01M8 13h.01M8 17h.01"
      />
    </svg>
  )
}

function RestaurantIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 3v18M4 8h4M4 13h4M17 3v18M14 8h6M17 3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3"
      />
    </svg>
  )
}

function DeliveryIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 6h11v9H3zM14 10h4l3 3v2h-4M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
      />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12H3M7 8l-4 4 4 4M13 5V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-1"
      />
    </svg>
  )
}

function DesktopDropdown({
  id,
  label,
  icon,
  items,
  openMenu,
  setOpenMenu,
}) {
  const location = useLocation()
  const isOpen = openMenu === id
  const hasActiveItem = items.some(
    (item) => location.pathname === item.to
  )
  function handleToggle(event) {
    event.preventDefault()
    event.stopPropagation()
    setOpenMenu((previous) =>
      previous === id ? null : id
    )
  }
  function handleItemClick() {
    setOpenMenu(null)
  }
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleToggle}
        className={`
          inline-flex items-center gap-2
          h-10
          px-3.5
          rounded-lg
          text-sm font-medium
          cursor-pointer
          select-none
          transition-all duration-200
          ${
            isOpen || hasActiveItem
              ? 'bg-gray-100 text-navy'
              : 'text-gray-600 hover:bg-gray-50 hover:text-navy'
          }
        `}
      >
        <span className="shrink-0">
          {icon}
        </span>
        <span>{label}</span>
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="
            absolute
            left-0
            top-full
            mt-2
            w-60
            rounded-xl
            border
            border-gray-100
            bg-white
            py-2
            shadow-2xl
            z-[200]
          "
        >
          {items.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={handleItemClick}
                className={`
                  flex items-center justify-between
                  mx-2
                  px-3
                  py-2.5
                  rounded-lg
                  text-sm
                  cursor-pointer
                  transition-colors
                  ${
                    active
                      ? 'bg-navy text-white font-semibold'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-navy'
                  }
                `}
              >
                <span>{item.label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red" />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MobileSection({
  label,
  icon,
  items,
  onClose,
}) {
  return (
    <section className="rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50">
        <span className="text-navy">
          {icon}
        </span>
        <span className="text-sm font-bold text-navy">
          {label}
        </span>
      </div>
      <div className="p-1">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClose}
            className="
              block
              px-3
              py-2.5
              rounded-lg
              text-sm
              text-gray-600
              hover:bg-gray-50
              hover:text-navy
              cursor-pointer
              transition-colors
            "
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const navbarRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (
        navbarRef.current &&
        !navbarRef.current.contains(event.target)
      ) {
        setOpenMenu(null)
        setAccountOpen(false)
      }
    }
    document.addEventListener(
      'pointerdown',
      handlePointerDown
    )
    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      )
    }
  }, [])

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
        setAccountOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener(
      'keydown',
      handleEscape
    )
    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape
      )
    }
  }, [])

  useEffect(() => {
    setOpenMenu(null)
    setAccountOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  // Phase 19.3: "My Orders" removed from both Restaurant and Delivery
  // dropdowns (was duplicated in both, per the 19.1 finding). "My Bookings",
  // "My Invoices", "My Reservations", and "My Bills" links now point into
  // the correct tab of the unified /my-account page instead of their own
  // separate legacy pages.
  const hotelItems = [
    {
      to: '/hotels',
      label: 'Browse Hotels',
    },
    {
      to: '/my-account?tab=bookings',
      label: 'My Bookings',
    },
    {
      to: '/my-account?tab=invoices',
      label: 'My Invoices',
    },
  ]
  const restaurantItems = [
    {
      to: '/restaurants',
      label: 'Restaurants',
    },
    {
      to: '/my-account?tab=reservations',
      label: 'My Reservations',
    },
  ]
  const deliveryItems = [
    {
      to: '/delivery',
      label: 'Order Food',
    },
    {
      to: '/delivery/orders',
      label: 'My Orders & Tracking',
    },
  ]

  const firstName = user?.first_name || 'User'
  const lastName = user?.last_name || ''
  const email = user?.email || ''
  const initial = firstName.charAt(0).toUpperCase()

  function toggleAccount(event) {
    event.preventDefault()
    event.stopPropagation()
    setOpenMenu(null)
    setAccountOpen((previous) => !previous)
  }

  function handleLogout(event) {
    event.preventDefault()
    event.stopPropagation()
    setOpenMenu(null)
    setAccountOpen(false)
    setMobileOpen(false)
    logout()
  }

  function toggleMobile() {
    setMobileOpen((previous) => !previous)
    setOpenMenu(null)
    setAccountOpen(false)
  }

  return (
    <nav
      ref={navbarRef}
      className="
        sticky top-0
        z-[100]
        w-full
        bg-white
        border-b border-gray-200
      "
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-[72px] flex items-center justify-between">
          <Link
            to="/"
            className="
              flex items-center gap-3
              shrink-0
              cursor-pointer
            "
          >
            <span className="text-2xl font-extrabold tracking-tight text-navy">
              IHG
            </span>
            <span className="hidden sm:block h-6 w-px bg-gray-200" />
            <span className="hidden sm:block text-xs font-medium tracking-widest uppercase text-gray-400">
              Hospitality
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-8 mr-auto">
            <DesktopDropdown
              id="hotel"
              label="Hotel"
              icon={<HotelIcon />}
              items={hotelItems}
              openMenu={openMenu}
              setOpenMenu={(value) => {
                setOpenMenu(value)
                setAccountOpen(null)
              }}
            />
            <DesktopDropdown
              id="restaurant"
              label="Restaurant"
              icon={<RestaurantIcon />}
              items={restaurantItems}
              openMenu={openMenu}
              setOpenMenu={(value) => {
                setOpenMenu(value)
                setAccountOpen(null)
              }}
            />
            <DesktopDropdown
              id="delivery"
              label="Delivery"
              icon={<DeliveryIcon />}
              items={deliveryItems}
              openMenu={openMenu}
              setOpenMenu={(value) => {
                setOpenMenu(value)
                setAccountOpen(null)
              }}
            />
            <Link
              to="/my-account"
              className={`
                inline-flex items-center gap-2
                h-10
                px-3.5
                rounded-lg
                text-sm font-medium
                cursor-pointer
                select-none
                transition-all duration-200
                ${
                  location.pathname === '/my-account'
                    ? 'bg-gray-100 text-navy'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-navy'
                }
              `}
            >
              <AccountIcon />
              <span>My Activity</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <NotificationBell variant="light" />
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={toggleAccount}
                className={`
                  flex items-center gap-3
                  px-2
                  py-1.5
                  rounded-xl
                  cursor-pointer
                  select-none
                  transition-colors
                  ${
                    accountOpen
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  }
                `}
              >
                <span className="w-9 h-9 rounded-full bg-navy flex items-center justify-center text-sm font-bold text-white">
                  {initial}
                </span>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-semibold text-navy leading-tight">
                    {firstName}
                  </p>
                  <p className="text-xs text-gray-400 leading-tight mt-0.5">
                    Account
                  </p>
                </div>
                <ChevronIcon open={accountOpen} />
              </button>
              {accountOpen && (
                <div
                  role="menu"
                  className="
                    absolute
                    right-0
                    top-full
                    mt-2
                    w-60
                    rounded-xl
                    border
                    border-gray-100
                    bg-white
                    py-2
                    shadow-2xl
                    z-[200]
                  "
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-navy">
                      {firstName} {lastName}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 break-all">
                      {email}
                    </p>
                  </div>
                  <Link
                    to="/my-account"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className="
                      flex
                      items-center
                      justify-between
                      px-4
                      py-3
                      mt-1
                      text-left
                      text-sm
                      font-medium
                      text-gray-700
                      hover:bg-gray-50
                      hover:text-navy
                      cursor-pointer
                      transition-colors
                    "
                  >
                    <span>My Account</span>
                    <AccountIcon />
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="
                      w-full
                      flex
                      items-center
                      justify-between
                      px-4
                      py-3
                      text-left
                      text-sm
                      font-medium
                      text-gray-700
                      hover:bg-gray-50
                      hover:text-red
                      cursor-pointer
                      transition-colors
                    "
                  >
                    <span>Sign out</span>
                    <LogoutIcon />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleMobile}
            className="
              md:hidden
              p-2
              rounded-lg
              text-navy
              hover:bg-gray-100
              cursor-pointer
              transition-colors
            "
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 6l12 12M18 6 6 18"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="
            md:hidden
            border-t border-gray-100
            bg-white
            shadow-lg
          "
        >
          <div className="px-4 py-4 space-y-2">
            <div className="px-3 py-2 mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider font-bold text-gray-400">
                  Welcome
                </p>
                <p className="text-base font-semibold text-navy mt-1">
                  {firstName} {lastName}
                </p>
              </div>
              <NotificationBell variant="light" />
            </div>
            <MobileSection
              label="Hotel"
              icon={<HotelIcon />}
              items={hotelItems}
              onClose={() => setMobileOpen(false)}
            />
            <MobileSection
              label="Restaurant"
              icon={<RestaurantIcon />}
              items={restaurantItems}
              onClose={() => setMobileOpen(false)}
            />
            <MobileSection
              label="Delivery"
              icon={<DeliveryIcon />}
              items={deliveryItems}
              onClose={() => setMobileOpen(false)}
            />
            <MobileSection
              label="My Activity"
              icon={<AccountIcon />}
              items={[{ to: '/my-account', label: 'My Account' }]}
              onClose={() => setMobileOpen(false)}
            />
            <div className="pt-3 mt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleLogout}
                className="
                  w-full
                  flex
                  items-center
                  justify-between
                  px-3
                  py-2.5
                  rounded-lg
                  text-left
                  text-sm
                  font-semibold
                  text-red
                  hover:bg-red/5
                  cursor-pointer
                  transition-colors
                "
              >
                <span>Sign out</span>
                <LogoutIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}