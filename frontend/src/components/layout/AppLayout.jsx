import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import CustomerAssistantWidget from '../ai/CustomerAssistantWidget'
import StaffAssistantWidget from '../ai/StaffAssistantWidget'

const STAFF_ROLES = [
  'SUPER_ADMIN',
  'MANAGER',
  'RECEPTIONIST',
  'HOUSEKEEPING',
  'WAITER',
  'KITCHEN',
  'DELIVERY',
]

function MobileStaffHeader({ onMenuOpen }) {
  const { user } = useAuth()

  return (
    <header className="lg:hidden sticky top-0 z-30 h-16 bg-navy border-b border-white/10 px-4 flex items-center justify-between">
      <Link
        to="/"
        className="text-xl font-extrabold tracking-tight text-white"
      >
        IHG
      </Link>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-semibold text-white">
            {user?.first_name}
          </p>

          <p className="text-[10px] text-white/40">
            {user?.role}
          </p>
        </div>

        <button
          type="button"
          onClick={onMenuOpen}
          className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
          aria-label="Open navigation"
        >
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
        </button>
      </div>
    </header>
  )
}

export default function AppLayout({ children }) {
  const { user } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isStaff = STAFF_ROLES.includes(user?.role)

  if (isStaff) {
    return (
      <div className="min-h-screen bg-gray-50">

        <Sidebar
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        <div className="lg:ml-64 min-h-screen flex flex-col">

          <MobileStaffHeader
            onMenuOpen={() => setMobileMenuOpen(true)}
          />

          <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>

        </div>

        <StaffAssistantWidget />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {user?.role === 'CUSTOMER' && <CustomerAssistantWidget />}
    </div>
  )
}