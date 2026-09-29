import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import NotificationBell from '../notifications/NotificationBell'
import Brand from './Brand'

const NAVY = '#1F3A5F'

function ChevronIcon({ open = false }) {
  return (
    <svg className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}

function HotelIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V9l6 3v9M8 9h.01M8 13h.01M8 17h.01" />
    </svg>
  )
}

function RestaurantIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v18M4 8h4M4 13h4M17 3v18M14 8h6M17 3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3" />
    </svg>
  )
}

function DeliveryIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h11v9H3zM14 10h4l3 3v2h-4M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3M7 8l-4 4 4 4M13 5V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-1" />
    </svg>
  )
}

// The section label IS the link — clicking "Hotel" goes to the hotel. The
// chevron opens only the guest's own items, so nothing in the dropdown
// repeats the label above it or leads somewhere the guest already is.
function NavSection({ id, label, icon, to, items, openMenu, setOpenMenu }) {
  const location = useLocation()
  const isOpen = openMenu === id
  const active = location.pathname === to
    || location.pathname.startsWith(`${to}/`)
    || items.some((item) => location.pathname + location.search === item.to)

  return (
    <div className="relative">
      <div
        className={`flex h-11 items-center rounded-xl transition-colors duration-200 ${
          isOpen || active ? 'bg-white/[0.12]' : 'hover:bg-white/[0.07]'
        }`}
      >
        <Link
          to={to}
          onClick={() => setOpenMenu(null)}
          className={`flex h-full items-center gap-2.5 rounded-l-xl pl-3.5 pr-2 text-[14px] font-semibold transition-colors ${
            active ? 'text-white' : 'text-white/75 hover:text-white'
          }`}
        >
          {/* Red marks the section you're in; white for the rest. Colouring
              them all red would remove that signal. */}
          <span className={active ? 'text-[#FF2147]' : 'text-white/75'}>{icon}</span>
          <span>{label}</span>
        </Link>

        {items.length > 0 && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-label={`${label} menu`}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setOpenMenu((previous) => (previous === id ? null : id))
            }}
            className={`flex h-full items-center rounded-r-xl pl-1 pr-3 transition-colors ${
              isOpen ? 'text-white' : 'text-white/45 hover:text-white'
            }`}
          >
            <ChevronIcon open={isOpen} />
          </button>
        )}
      </div>

      {active && <span className="absolute inset-x-3 -bottom-[14px] h-[3px] rounded-full bg-[#FF2147]" />}

      {isOpen && items.length > 0 && (
        <div role="menu" className="absolute left-0 top-full z-[200] mt-3 w-60 overflow-hidden rounded-xl border border-black/5 bg-white py-2 shadow-2xl">
          {items.map((item) => {
            const itemActive = location.pathname + location.search === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpenMenu(null)}
                className={`mx-2 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  itemActive ? 'bg-[#1F3A5F] font-semibold text-white' : 'text-slate-700 hover:bg-slate-50 hover:text-[#1F3A5F]'
                }`}
              >
                <span>{item.label}</span>
                {itemActive && <span className="h-1.5 w-1.5 rounded-full bg-[#FF2147]" />}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MobileSection({ label, icon, to, items, onClose }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10">
      <Link to={to} onClick={onClose} className="flex items-center gap-2.5 bg-white/[0.06] px-3.5 py-3 text-sm font-bold text-white">
        <span className="text-[#FF2147]">{icon}</span>
        <span>{label}</span>
        <span className="ml-auto text-white/35">→</span>
      </Link>
      {items.length > 0 && (
        <div className="p-1">
          {items.map((item) => (
            <Link key={item.to} to={item.to} onClick={onClose} className="block rounded-lg px-3.5 py-2.5 text-sm text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white">
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [openMenu, setOpenMenu] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const navbarRef = useRef(null)

  useEffect(() => {
    function handlePointerDown(event) {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setOpenMenu(null)
        setAccountOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
        setAccountOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    setOpenMenu(null)
    setAccountOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  // Each section's own page is reached by the label itself, so the
  // dropdowns carry only the guest's personal items — no "Browse Hotels"
  // inside "Hotel", and no dead links.
  const sections = [
    {
      id: 'hotel',
      label: 'Hotel',
      icon: <HotelIcon />,
      to: '/hotels',
      items: user
        ? [
            { to: '/my-account?tab=bookings', label: 'My Bookings' },
            { to: '/my-account?tab=invoices', label: 'My Invoices' },
          ]
        : [],
    },
    {
      id: 'restaurant',
      label: 'Restaurant',
      icon: <RestaurantIcon />,
      to: '/restaurants',
      items: user ? [{ to: '/my-account?tab=reservations', label: 'My Reservations' }] : [],
    },
    {
      id: 'delivery',
      label: 'Delivery',
      icon: <DeliveryIcon />,
      to: '/delivery',
      items: user ? [{ to: '/delivery/orders', label: 'My Orders & Tracking' }] : [],
    },
  ]

  const firstName = user?.first_name || ''
  const lastName = user?.last_name || ''
  const email = user?.email || ''
  const initial = firstName.charAt(0).toUpperCase() || '?'

  function handleLogout(event) {
    event.preventDefault()
    event.stopPropagation()
    setOpenMenu(null)
    setAccountOpen(false)
    setMobileOpen(false)
    logout()
    navigate('/hotels', { replace: true })
  }

  return (
    <nav ref={navbarRef} className="sticky top-0 z-[100] w-full bg-[#1F3A5F] shadow-[0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(15,23,42,0.5)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-[76px] items-center justify-between">
          <Link to="/hotels" className="shrink-0">
            <Brand variant="dark" size="md" />
          </Link>

          {/* Absolutely positioned so the tabs centre against the whole bar
              rather than the gap between the logo and the buttons, which
              are different widths. */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 xl:flex">
            {sections.map((section) => (
              <NavSection key={section.id} {...section} openMenu={openMenu} setOpenMenu={setOpenMenu} />
            ))}

            {user && (
              <Link
                to="/my-account"
                className={`flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-[14px] font-semibold transition-colors ${
                  location.pathname === '/my-account' ? 'bg-white/[0.12] text-white' : 'text-white/75 hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                <span className={location.pathname === '/my-account' ? 'text-[#FF2147]' : 'text-white/55'}><AccountIcon /></span>
                <span>My Activity</span>
              </Link>
            )}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {!user ? (
              <>
                <Link to="/login" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white">
                  Sign in
                </Link>
                <Link to="/register" className="rounded-xl bg-[#FF2147] px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-[#dc1539]">
                  Join
                </Link>
              </>
            ) : (
              <>
                <NotificationBell variant="dark" />
                <div className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={accountOpen}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setOpenMenu(null)
                      setAccountOpen((previous) => !previous)
                    }}
                    className={`flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${accountOpen ? 'bg-white/[0.12]' : 'hover:bg-white/[0.07]'}`}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF2147] text-sm font-bold text-white">
                      {initial}
                    </span>
                    <span className="hidden text-left lg:block">
                      <span className="block text-sm font-semibold leading-tight text-white">{firstName}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-white/45">Account</span>
                    </span>
                    <span className="text-white/45"><ChevronIcon open={accountOpen} /></span>
                  </button>

                  {accountOpen && (
                    <div role="menu" className="absolute right-0 top-full z-[200] mt-3 w-64 overflow-hidden rounded-xl border border-black/5 bg-white py-2 shadow-2xl">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="text-sm font-semibold text-[#1F3A5F]">{firstName} {lastName}</p>
                        <p className="mt-1 break-all text-xs text-slate-400">{email}</p>
                      </div>
                      <Link to="/my-account" role="menuitem" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#1F3A5F]">
                        <span>My Account</span>
                        <AccountIcon />
                      </Link>
                      <button type="button" role="menuitem" onClick={handleLogout} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:text-[#FF2147]">
                        <span>Sign out</span>
                        <LogoutIcon />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setMobileOpen((p) => !p); setOpenMenu(null); setAccountOpen(false) }}
            className="rounded-lg p-2 text-white transition-colors hover:bg-white/10 md:hidden"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#1A3151] md:hidden">
          <div className="space-y-2 px-4 py-4">
            {user ? (
              <div className="mb-3 flex items-center justify-between px-1 py-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Welcome</p>
                  <p className="mt-1 text-base font-semibold text-white">{firstName} {lastName}</p>
                </div>
                <NotificationBell variant="dark" />
              </div>
            ) : (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="rounded-xl border border-white/20 py-3 text-center text-sm font-semibold text-white">
                  Sign in
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="rounded-xl bg-[#FF2147] py-3 text-center text-sm font-bold text-white">
                  Join
                </Link>
              </div>
            )}

            {sections.map((section) => (
              <MobileSection key={section.id} {...section} onClose={() => setMobileOpen(false)} />
            ))}

            {user && (
              <>
                <MobileSection
                  label="My Activity"
                  icon={<AccountIcon />}
                  to="/my-account"
                  items={[]}
                  onClose={() => setMobileOpen(false)}
                />
                <div className="mt-3 border-t border-white/10 pt-3">
                  <button type="button" onClick={handleLogout} className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-bold text-[#FF2147] transition-colors hover:bg-white/[0.06]">
                    <span>Sign out</span>
                    <LogoutIcon />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}