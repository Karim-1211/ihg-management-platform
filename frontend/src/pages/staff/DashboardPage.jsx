import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/AppLayout'

/* =========================================================
   ROUTES / ATTENTION STYLES
========================================================= */

const ATTENTION_ROUTES = {
  service_request: '/staff/service-requests',
  failed_payment: '/staff/invoices',
  low_stock: '/staff/inventory',
}

const ATTENTION_STYLES = {
  service_request: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', dot: 'bg-amber-500', border: 'border-amber-300' },
  failed_payment: { iconBg: 'bg-red-50', iconColor: 'text-red-600', dot: 'bg-red-500', border: 'border-red-300' },
  low_stock: { iconBg: 'bg-red-50', iconColor: 'text-red-600', dot: 'bg-red-500', border: 'border-red-300' },
}

/* =========================================================
   SHADOWS
========================================================= */

const SHADOW_REST = 'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.10)]'
const SHADOW_HOVER = 'shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_-2px_rgba(15,23,42,0.08),0_28px_52px_-14px_rgba(15,23,42,0.16)]'

/* =========================================================
   ICONS
========================================================= */

function IconBed({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V8a2 2 0 0 1 2-2h4v4M13 6h4a3 3 0 0 1 3 3v3" />
    </svg>
  )
}
function IconReceipt({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2h12v20l-3-2-3 2-3-2-3 2V2ZM9 8h6M9 12h6M9 16h3" />
    </svg>
  )
}
function IconDollar({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M17 6.5c0-1.7-2-3-5-3s-5 1.3-5 3 2 3 5 3 5 1.3 5 3-2 3-5 3-5-1.3-5-3" />
    </svg>
  )
}
function IconTruck({ className = 'w-6 h-6' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h11v9H3zM14 10h4l3 3v2h-4M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  )
}
function IconWarning({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  )
}
function IconCheck({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  )
}
function IconHotel({ className = 'w-[18px] h-[18px]' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l8-4v18M13 21V9l6 3v9M8 9h.01M8 13h.01M8 17h.01" />
    </svg>
  )
}
function IconRestaurant({ className = 'w-[18px] h-[18px]' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 3v18M4 8h4M4 13h4M17 3v18M14 8h6M17 3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3" />
    </svg>
  )
}
function IconBox({ className = 'w-[18px] h-[18px]' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5M21 8v8l-9 5M12 13v8" />
    </svg>
  )
}
function IconArrowRight({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/* =========================================================
   KPI CARD — color-shifting hover
========================================================= */

const KPI_STYLES = {
  hotel: { iconBg: 'bg-blue-50', iconText: 'text-blue-700', bar: 'bg-blue-500', hoverBorder: 'group-hover:border-blue-200', hoverIcon: 'group-hover:bg-blue-100' },
  restaurant: { iconBg: 'bg-amber-50', iconText: 'text-amber-700', bar: 'bg-amber-500', hoverBorder: 'group-hover:border-amber-200', hoverIcon: 'group-hover:bg-amber-100' },
  revenue: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-700', bar: 'bg-emerald-600', hoverBorder: 'group-hover:border-emerald-200', hoverIcon: 'group-hover:bg-emerald-100' },
  delivery: { iconBg: 'bg-indigo-50', iconText: 'text-indigo-700', bar: 'bg-indigo-500', hoverBorder: 'group-hover:border-indigo-200', hoverIcon: 'group-hover:bg-indigo-100' },
}

function KpiCard({ icon, accent, label, value, subtext }) {
  const styles = KPI_STYLES[accent] || KPI_STYLES.hotel
  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white
        p-6 ${SHADOW_REST}
        transition-all duration-300 hover:-translate-y-[3px] hover:${SHADOW_HOVER} ${styles.hoverBorder}
      `}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-3 text-[38px] font-bold leading-none tracking-[-0.03em] text-slate-900">{value}</p>
          {subtext && <p className="mt-3 text-[12.5px] font-medium text-slate-400">{subtext}</p>}
        </div>
        <div
          className={`
            flex h-12 w-12 shrink-0 items-center justify-center rounded-xl
            ${styles.iconBg} ${styles.iconText} ${styles.hoverIcon}
            shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(15,23,42,0.06)]
            ring-1 ring-inset ring-black/[0.03]
            transition-all duration-300 group-hover:scale-105
          `}
        >
          {icon}
        </div>
      </div>

      <div className={`absolute bottom-0 left-0 right-0 h-[3px] ${styles.bar} opacity-80 transition-opacity duration-300 group-hover:opacity-100`} />
    </div>
  )
}

/* =========================================================
   STATUS RAIL
========================================================= */

const STATUS_DOT = { healthy: 'bg-emerald-500', active: 'bg-indigo-500', warning: 'bg-amber-500', na: 'bg-slate-300' }

function StatusRail({ overview }) {
  const items = [
    { label: 'Hotel', status: !overview.hotel.applicable ? 'na' : 'healthy', text: !overview.hotel.applicable ? 'N/A' : 'Healthy' },
    {
      label: 'Restaurant',
      status: !overview.restaurant.applicable ? 'na' : overview.restaurant.orders_today.total > 0 ? 'active' : 'healthy',
      text: !overview.restaurant.applicable ? 'N/A' : overview.restaurant.orders_today.total > 0 ? 'Busy' : 'Healthy',
    },
    {
      label: 'Delivery',
      status: !overview.delivery.applicable ? 'na' : overview.delivery.active_deliveries > 0 ? 'active' : 'healthy',
      text: !overview.delivery.applicable ? 'N/A' : overview.delivery.active_deliveries > 0 ? 'Active' : 'Healthy',
    },
    {
      label: 'Inventory',
      status: !overview.inventory.applicable ? 'na' : overview.inventory.low_stock_count > 0 ? 'warning' : 'healthy',
      text: !overview.inventory.applicable ? 'N/A' : overview.inventory.low_stock_count > 0 ? 'Warning' : 'Healthy',
    },
  ]
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-9 gap-y-2.5 rounded-2xl border border-slate-200/80 bg-white px-6 py-4 ${SHADOW_REST}`}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[item.status]}`} />
          <span className="text-[12.5px] font-semibold text-slate-700">{item.label}</span>
          <span className="text-[12.5px] font-medium text-slate-400">· {item.text}</span>
        </div>
      ))}
    </div>
  )
}

/* =========================================================
   SECTION CARD — real tinted title bar with its own shadow
========================================================= */

const SECTION_STYLES = {
  hotel: {
    headerBg: 'bg-gradient-to-r from-blue-50 to-blue-50/40',
    headerShadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(37,99,235,0.15)]',
    iconBg: 'bg-white', iconText: 'text-blue-700', iconRing: 'ring-blue-100',
    hoverBorder: 'hover:border-blue-200',
  },
  restaurant: {
    headerBg: 'bg-gradient-to-r from-amber-50 to-amber-50/40',
    headerShadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(217,119,6,0.15)]',
    iconBg: 'bg-white', iconText: 'text-amber-700', iconRing: 'ring-amber-100',
    hoverBorder: 'hover:border-amber-200',
  },
  delivery: {
    headerBg: 'bg-gradient-to-r from-indigo-50 to-indigo-50/40',
    headerShadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(79,70,229,0.15)]',
    iconBg: 'bg-white', iconText: 'text-indigo-700', iconRing: 'ring-indigo-100',
    hoverBorder: 'hover:border-indigo-200',
  },
  inventory: {
    headerBg: 'bg-gradient-to-r from-emerald-50 to-emerald-50/40',
    headerShadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(5,150,105,0.15)]',
    iconBg: 'bg-white', iconText: 'text-emerald-700', iconRing: 'ring-emerald-100',
    hoverBorder: 'hover:border-emerald-200',
  },
}

function SectionCard({ icon, accent, title, subtitle, applicable, notApplicableText, children }) {
  const styles = SECTION_STYLES[accent] || SECTION_STYLES.hotel
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white ${SHADOW_REST} transition-all duration-300 hover:${SHADOW_HOVER} ${styles.hoverBorder}`}>
      <div className={`relative z-10 flex items-center gap-3.5 px-6 py-5 ${styles.headerBg} ${styles.headerShadow}`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.iconBg} ${styles.iconText} shadow-sm ring-1 ${styles.iconRing}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-tight text-slate-800">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] font-medium text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6">
        {applicable ? children : (
          <div className="py-6"><p className="text-sm font-medium text-slate-400">{notApplicableText}</p></div>
        )}
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight = false }) {
  return (
    <div className="group/row flex items-center justify-between gap-4 border-b border-slate-100 py-4 transition-colors last:border-0 hover:bg-slate-50/60 -mx-6 px-6">
      <span className="text-[13.5px] font-medium text-slate-500 transition-colors group-hover/row:text-slate-700">{label}</span>
      <span className={`text-[17px] font-bold tracking-tight ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

/* =========================================================
   ATTENTION PANEL
========================================================= */

function AttentionPanel({ attention, navigate }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-red-100 bg-white ${SHADOW_HOVER}`}>
      <div className="relative z-10 flex items-center gap-3.5 bg-gradient-to-r from-red-50 to-orange-50/40 px-6 py-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(220,38,38,0.18)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm ring-1 ring-red-100">
          <IconWarning className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold tracking-tight text-slate-800">Attention Required</h2>
            {attention.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10.5px] font-bold text-white shadow-sm">
                {attention.length}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">Items requiring management review</p>
        </div>
      </div>

      {attention.length === 0 ? (
        <div className="flex items-center gap-3.5 px-6 py-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <IconCheck className="h-[18px] w-[18px]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No immediate issues</p>
            <p className="mt-0.5 text-[12px] font-medium text-slate-400">Nothing currently requires your attention.</p>
          </div>
        </div>
      ) : (
        <div>
          {attention.map((item, idx) => {
            const styles = ATTENTION_STYLES[item.category] || ATTENTION_STYLES.service_request
            const route = ATTENTION_ROUTES[item.category]
            return (
              <button
                key={`${item.category}-${idx}`}
                type="button"
                disabled={!route}
                onClick={() => route && navigate(route)}
                className={`group flex w-full items-center gap-3.5 border-b border-slate-100 border-l-2 px-6 py-4 text-left transition-colors last:border-b-0 ${styles.border} ${route ? 'hover:bg-red-50/40' : ''}`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-slate-700 transition-colors group-hover:text-slate-900">{item.label}</span>
                {route && (
                  <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-red-600 transition-all group-hover:gap-1.5">
                    View <IconArrowRight />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* =========================================================
   LOADING
========================================================= */

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-[150px] animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
      <div className="h-[56px] animate-pulse rounded-2xl bg-slate-100" />
      <div className="h-[160px] animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-[230px] animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  )
}

/* =========================================================
   MAIN
========================================================= */

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadOverview() }, [])

  function loadOverview() {
    setLoading(true)
    setError('')
    api.get('/dashboard/overview')
      .then((res) => setOverview(res.data))
      .catch(() => setError('Could not load dashboard data.'))
      .finally(() => setLoading(false))
  }

  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  const hotelApplicable = overview?.hotel?.applicable
  const restaurantApplicable = overview?.restaurant?.applicable
  const deliveryApplicable = overview?.delivery?.applicable
  const inventoryApplicable = overview?.inventory?.applicable

  return (
    <AppLayout>
      <header className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-8 overflow-hidden bg-gradient-to-br from-[#1F3A5F] to-[#132840]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-40 w-64 rounded-full bg-red-500/[0.06] blur-3xl" />

        <div className="relative px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">Management</span>
            <span className="text-white/25">·</span>
            <span className="text-[10.5px] font-medium tracking-wide text-white/50">{todayLabel}</span>
          </div>

          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[46px]">
            Management Dashboard
          </h1>

          <p className="mt-3 max-w-xl text-[14px] font-normal leading-6 text-white/50">
            Good day, <span className="font-semibold text-white/85">{user?.first_name}</span> — here's the current operational overview of your hospitality business.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            type="button"
            onClick={loadOverview}
            className="w-fit rounded-xl bg-[#1F3A5F] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#172F4D]"
          >
            Retry
          </button>
        </div>
      )}

      {loading && <DashboardSkeleton />}

      {!loading && overview && (
        <div className="space-y-8">
          <section>
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Business Overview</p>
              <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-slate-800">Today's performance</h2>
            </div>

            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              <KpiCard
                icon={<IconBed />}
                accent="hotel"
                label="Occupancy"
                value={hotelApplicable && overview.hotel.current_occupancy_percent !== null ? `${overview.hotel.current_occupancy_percent}%` : '—'}
                subtext={hotelApplicable ? 'Currently checked in' : 'No hotel in scope'}
              />
              <KpiCard
                icon={<IconReceipt />}
                accent="restaurant"
                label="Orders Today"
                value={overview.restaurant.orders_today.total}
                subtext={restaurantApplicable ? `Dine-in ${overview.restaurant.orders_today.dine_in} · Delivery ${overview.restaurant.orders_today.delivery}` : 'No restaurant in scope'}
              />
              <KpiCard
                icon={<IconDollar />}
                accent="revenue"
                label="Revenue Today"
                value={`$${Number(overview.financial.revenue_today || 0).toFixed(2)}`}
                subtext="Completed payments only"
              />
              <KpiCard
                icon={<IconTruck />}
                accent="delivery"
                label="Active Deliveries"
                value={overview.delivery.active_deliveries}
                subtext={deliveryApplicable ? 'Currently in progress' : 'No delivery in scope'}
              />
            </div>
          </section>

          <section>
            <StatusRail overview={overview} />
          </section>

          <section>
            <AttentionPanel attention={overview.attention || []} navigate={navigate} />
          </section>

          <section>
            <div className="mb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Operations</p>
              <h2 className="mt-1.5 text-[19px] font-bold tracking-tight text-slate-800">Operational areas</h2>
              <p className="mt-1 text-[13px] font-medium text-slate-400">Current activity across the connected business areas.</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <SectionCard
                icon={<IconHotel />}
                accent="hotel"
                title="Hotel Operations"
                subtitle="Property and guest activity"
                applicable={hotelApplicable}
                notApplicableText="No hotel operations in your scope."
              >
                <StatRow label="Current Occupancy" value={overview.hotel.current_occupancy_percent !== null ? `${overview.hotel.current_occupancy_percent}%` : '—'} />
                <StatRow label="Check-ins Today" value={overview.hotel.check_ins_today} />
                <StatRow label="Check-outs Today" value={overview.hotel.check_outs_today} />
              </SectionCard>

              <SectionCard
                icon={<IconRestaurant />}
                accent="restaurant"
                title="Restaurant Operations"
                subtitle="Today's order activity"
                applicable={restaurantApplicable}
                notApplicableText="No restaurant operations in your scope."
              >
                <StatRow label="Total Orders Today" value={overview.restaurant.orders_today.total} />
                <StatRow label="Dine-In" value={overview.restaurant.orders_today.dine_in} />
                <StatRow label="Room Service" value={overview.restaurant.orders_today.room_service} />
                <StatRow label="Delivery" value={overview.restaurant.orders_today.delivery} />
              </SectionCard>

              <SectionCard
                icon={<IconTruck />}
                accent="delivery"
                title="Delivery Operations"
                subtitle="Live fulfilment activity"
                applicable={deliveryApplicable}
                notApplicableText="No delivery operations in your scope."
              >
                <StatRow label="Active Deliveries" value={overview.delivery.active_deliveries} />
              </SectionCard>

              <SectionCard
                icon={<IconBox />}
                accent="inventory"
                title="Inventory Health"
                subtitle="Shared stock availability"
                applicable={inventoryApplicable}
                notApplicableText="No inventory in your scope."
              >
                <StatRow label="Low Stock Items" value={overview.inventory.low_stock_count} highlight={overview.inventory.low_stock_count > 0} />
              </SectionCard>
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  )
}