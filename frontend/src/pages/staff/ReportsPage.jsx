import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

/* =========================================================
   SHADOWS — reused from DashboardPage's system
========================================================= */

const SHADOW_REST = 'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.10)]'
const SHADOW_HOVER = 'shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_-2px_rgba(15,23,42,0.08),0_28px_52px_-14px_rgba(15,23,42,0.16)]'

/* =========================================================
   PERIOD PRESETS
========================================================= */

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'last_30_days', label: 'Last 30 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'previous_month', label: 'Previous Month' },
  { key: 'custom', label: 'Custom' },
]

const REPORT_TABS = [
  { key: 'executive', label: 'Executive Overview' },
  { key: 'hotel', label: 'Hotel Performance' },
  { key: 'restaurant', label: 'Restaurant Performance' },
  { key: 'delivery', label: 'Delivery Performance' },
  { key: 'inventory', label: 'Inventory Performance' },
  { key: 'operations', label: 'Operational Performance' },
]

/* =========================================================
   ICONS
========================================================= */

function IconChevronDown({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}
function IconCalendar({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 9h18M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  )
}
function IconArrowUp({ className = 'w-3 h-3' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}
function IconArrowDown({ className = 'w-3 h-3' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  )
}

/* =========================================================
   SHARED PRIMITIVES
========================================================= */

function formatNumber(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatCurrency(n) {
  if (n === null || n === undefined) return '—'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ChangeBadge({ periodValue }) {
  if (!periodValue) return null
  const { change_percent, change_label } = periodValue
  if (change_percent === null || change_percent === undefined) {
    return <span className="text-[11px] font-medium text-slate-400">{change_label}</span>
  }
  const positive = change_percent > 0
  const negative = change_percent < 0
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${positive ? 'text-emerald-600' : negative ? 'text-red-600' : 'text-slate-400'}`}>
      {positive && <IconArrowUp />}
      {negative && <IconArrowDown />}
      {change_label}
    </span>
  )
}

function MetricCard({ label, value, isCurrency = false, periodValue, subtext, accent = 'navy' }) {
  const ACCENT_BAR = {
    navy: 'bg-[#1F3A5F]', blue: 'bg-blue-500', amber: 'bg-amber-500',
    indigo: 'bg-indigo-500', emerald: 'bg-emerald-600', red: 'bg-red-500',
  }
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 ${SHADOW_REST}`}>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2.5 text-[28px] font-bold leading-none tracking-[-0.02em] text-slate-900">
        {isCurrency ? formatCurrency(value) : formatNumber(value)}
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        {periodValue && <ChangeBadge periodValue={periodValue} />}
        {subtext && <span className="text-[11px] font-medium text-slate-400">{subtext}</span>}
      </div>
      <div className={`absolute bottom-0 left-0 right-0 h-[3px] ${ACCENT_BAR[accent]} opacity-80`} />
    </div>
  )
}

function ReportSection({ title, subtitle, accent = 'navy', children }) {
  const HEADER_STYLES = {
    navy: { bg: 'bg-gradient-to-r from-slate-50 to-slate-50/40', shadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(15,23,42,0.12)]' },
    blue: { bg: 'bg-gradient-to-r from-blue-50 to-blue-50/40', shadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(37,99,235,0.15)]' },
    amber: { bg: 'bg-gradient-to-r from-amber-50 to-amber-50/40', shadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(217,119,6,0.15)]' },
    indigo: { bg: 'bg-gradient-to-r from-indigo-50 to-indigo-50/40', shadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(79,70,229,0.15)]' },
    emerald: { bg: 'bg-gradient-to-r from-emerald-50 to-emerald-50/40', shadow: 'shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_10px_-4px_rgba(5,150,105,0.15)]' },
  }
  const styles = HEADER_STYLES[accent] || HEADER_STYLES.navy
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white ${SHADOW_REST}`}>
      <div className={`px-6 py-4 ${styles.bg} ${styles.shadow}`}>
        <h3 className="text-[15px] font-bold tracking-tight text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11.5px] font-medium text-slate-500">{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="text-[13px] font-medium text-slate-500">{label}</span>
      <span className={`text-[15px] font-bold tracking-tight ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

function NotApplicableCard({ text }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-8 text-center ${SHADOW_REST}`}>
      <p className="text-sm font-medium text-slate-400">{text}</p>
    </div>
  )
}

function ComparisonTable({ rows }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white ${SHADOW_REST}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/60">
            <th className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Metric</th>
            <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Current</th>
            <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Previous</th>
            <th className="px-6 py-3 text-right text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-slate-50 last:border-0">
              <td className="px-6 py-3 font-medium text-slate-600">{r.label}</td>
              <td className="px-6 py-3 text-right font-bold text-slate-900">{r.isCurrency ? formatCurrency(r.pv.current) : formatNumber(r.pv.current)}</td>
              <td className="px-6 py-3 text-right font-medium text-slate-400">{r.pv.previous === null ? '—' : (r.isCurrency ? formatCurrency(r.pv.previous) : formatNumber(r.pv.previous))}</td>
              <td className="px-6 py-3 text-right"><ChangeBadge periodValue={r.pv} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* =========================================================
   PERIOD SELECTOR
========================================================= */

function PeriodSelector({ preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, periodEcho }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-4 ${SHADOW_REST}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
          <IconCalendar /> Period
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`
              rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors
              ${preset === p.key ? 'bg-[#1F3A5F] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
            `}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">Start</label>
            <input
              type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-400">End</label>
            <input
              type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20"
            />
          </div>
        </div>
      )}

      {periodEcho && (
        <p className="mt-3 text-[12px] font-medium text-slate-500">
          <span className="font-bold text-slate-700">{periodEcho.start}</span> — <span className="font-bold text-slate-700">{periodEcho.end}</span>
          <span className="mx-2 text-slate-300">·</span>
          Compared with <span className="font-semibold text-slate-600">{periodEcho.compare_start}</span> — <span className="font-semibold text-slate-600">{periodEcho.compare_end}</span>
        </p>
      )}
    </div>
  )
}

/* =========================================================
   REPORT PANELS
========================================================= */

function ExecutivePanel({ data, navigate }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Revenue" value={data.revenue.current} isCurrency periodValue={data.revenue} accent="emerald" />
        <MetricCard label="Bookings Created" value={data.bookings_created.current} periodValue={data.bookings_created} accent="blue" />
        <MetricCard label="Orders Created" value={data.orders_created.current} periodValue={data.orders_created} accent="amber" />
        <MetricCard label="Failed Payments" value={data.failed_payments.current} periodValue={data.failed_payments} accent="red" />
      </div>

      <ReportSection title="Orders by Channel" subtitle="Order creation activity split by type" accent="amber">
        <DetailRow label="Dine-In" value={formatNumber(data.orders_by_type.dine_in.current)} />
        <DetailRow label="Room Service" value={formatNumber(data.orders_by_type.room_service.current)} />
        <DetailRow label="Delivery" value={formatNumber(data.orders_by_type.delivery.current)} />
      </ReportSection>

      <ReportSection title="Inventory Activity" subtitle="Stock transactions during the period" accent="emerald">
        <MetricCard label="Total Transactions" value={data.inventory_activity_total.current} periodValue={data.inventory_activity_total} accent="emerald" />
        <div className="mt-4 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          <DetailRow label="Purchases" value={data.inventory_activity_by_type.purchase} />
          <DetailRow label="Order Usage" value={data.inventory_activity_by_type.order_usage} />
          <DetailRow label="Waste" value={data.inventory_activity_by_type.waste} />
          <DetailRow label="Adjustments" value={data.inventory_activity_by_type.manual_adjustment} />
          <DetailRow label="Returns" value={data.inventory_activity_by_type.return} />
          <DetailRow label="Service Usage" value={data.inventory_activity_by_type.service_usage} />
        </div>
      </ReportSection>

      <ReportSection title="Attention" subtitle="Current operational snapshot — not period-based" accent="navy">
        <div
          onClick={() => navigate('/staff/service-requests')}
          className="flex cursor-pointer items-center justify-between rounded-xl bg-amber-50/60 px-4 py-3 transition-colors hover:bg-amber-50"
        >
          <span className="text-[13px] font-semibold text-slate-700">Overdue service requests (right now)</span>
          <span className="text-[15px] font-bold text-amber-700">{data.overdue_service_requests_now}</span>
        </div>
      </ReportSection>
    </div>
  )
}

function HotelPanel({ data }) {
  if (!data.applicable) return <NotApplicableCard text="No hotel operations in your scope." />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Bookings Created" value={data.bookings_created.current} periodValue={data.bookings_created} accent="blue" />
        <MetricCard label="Check-Ins Scheduled" value={data.check_ins_scheduled.current} periodValue={data.check_ins_scheduled} accent="blue" />
        <MetricCard label="Check-Outs Scheduled" value={data.check_outs_scheduled.current} periodValue={data.check_outs_scheduled} accent="blue" />
        <MetricCard label="Hotel Revenue" value={data.hotel_revenue.current} isCurrency periodValue={data.hotel_revenue} accent="emerald" />
      </div>
      <ReportSection title="Demand & Occupancy" subtitle="Room-night demand is a period measure; occupancy is a live snapshot" accent="blue">
        <DetailRow label="Room-Night Demand (booked nights overlapping period)" value={formatNumber(data.room_night_demand.current)} />
        <DetailRow label="Current Occupancy (live snapshot, not period-based)" value={data.current_occupancy_percent !== null ? `${data.current_occupancy_percent}%` : '—'} />
      </ReportSection>
    </div>
  )
}

function RestaurantPanel({ data }) {
  if (!data.applicable) return <NotApplicableCard text="No restaurant operations in your scope." />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Orders Created" value={data.orders_created.current} periodValue={data.orders_created} accent="amber" />
        <MetricCard label="Restaurant Revenue" value={data.restaurant_revenue.current} isCurrency periodValue={data.restaurant_revenue} accent="emerald" />
        <MetricCard label="Average Order Value" value={data.average_order_value} isCurrency accent="amber" />
        <MetricCard label="Currently Cancelled" value={data.orders_currently_cancelled_created_in_period.current} periodValue={data.orders_currently_cancelled_created_in_period} accent="red" />
      </div>
      <ReportSection title="Order Outcomes" subtitle="Among orders created in this period, evaluated at current status" accent="amber">
        <DetailRow label="Currently Served" value={formatNumber(data.orders_currently_served_created_in_period.current)} />
        <DetailRow label="Currently Cancelled" value={formatNumber(data.orders_currently_cancelled_created_in_period.current)} highlight={data.orders_currently_cancelled_created_in_period.current > 0} />
      </ReportSection>
    </div>
  )
}

function DeliveryPanel({ data }) {
  if (!data.applicable) return <NotApplicableCard text="No delivery operations in your scope." />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Deliveries Created" value={data.deliveries_created.current} periodValue={data.deliveries_created} accent="indigo" />
        <MetricCard label="Delivered in Period" value={data.deliveries_delivered_in_period.current} periodValue={data.deliveries_delivered_in_period} accent="indigo" />
        <MetricCard label="Currently Cancelled" value={data.deliveries_currently_cancelled_created_in_period.current} periodValue={data.deliveries_currently_cancelled_created_in_period} accent="red" />
        <MetricCard
          label="Avg. Completion Time"
          value={data.average_completion_minutes !== null ? `${data.average_completion_minutes} min` : '—'}
          accent="indigo"
        />
      </div>
    </div>
  )
}

function InventoryPanel({ data }) {
  if (!data.applicable) return <NotApplicableCard text="No inventory in your scope." />
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Total Transactions" value={data.inventory_activity_total.current} periodValue={data.inventory_activity_total} accent="emerald" />
        <MetricCard label="Low Stock Items (now)" value={data.low_stock_items_now} accent="red" />
      </div>
      <ReportSection title="Activity Breakdown" subtitle="Current-period transaction types" accent="emerald">
        <div className="grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          <DetailRow label="Purchases" value={data.inventory_activity_by_type.purchase} />
          <DetailRow label="Order Usage" value={data.inventory_activity_by_type.order_usage} />
          <DetailRow label="Waste" value={data.inventory_activity_by_type.waste} />
          <DetailRow label="Adjustments" value={data.inventory_activity_by_type.manual_adjustment} />
          <DetailRow label="Returns" value={data.inventory_activity_by_type.return} />
          <DetailRow label="Service Usage" value={data.inventory_activity_by_type.service_usage} />
        </div>
      </ReportSection>
    </div>
  )
}

function OperationsPanel({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard label="Service Requests Created" value={data.service_requests_created.current} periodValue={data.service_requests_created} accent="navy" />
        <MetricCard label="Service Requests Completed" value={data.service_requests_completed.current} periodValue={data.service_requests_completed} accent="emerald" />
        <MetricCard label="Overdue (now)" value={data.service_requests_overdue_now} accent="red" />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ReportSection title="Order Backlog" subtitle="Current snapshot — orders not yet served or cancelled" accent="amber">
          {data.orders_backlog_now.length === 0
            ? <p className="text-sm font-medium text-slate-400">No active order backlog.</p>
            : data.orders_backlog_now.map((s) => <DetailRow key={s.status} label={s.status} value={s.count} />)}
        </ReportSection>
        <ReportSection title="Delivery Backlog" subtitle="Current snapshot — deliveries not yet completed" accent="indigo">
          {data.deliveries_backlog_now.length === 0
            ? <p className="text-sm font-medium text-slate-400">No active delivery backlog.</p>
            : data.deliveries_backlog_now.map((s) => <DetailRow key={s.status} label={s.status} value={s.count} />)}
        </ReportSection>
      </div>

      <ReportSection title="Payment Activity" subtitle="Payment attempts recorded during this period, by outcome" accent="navy">
        <ComparisonTable
          rows={[
            { label: 'Completed', pv: data.payments_completed },
            { label: 'Failed', pv: data.payments_failed },
            { label: 'Pending', pv: data.payments_pending },
          ]}
        />
      </ReportSection>
    </div>
  )
}

/* =========================================================
   MAIN
========================================================= */

export default function ReportsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('executive')
  const [preset, setPreset] = useState('last_30_days')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const buildQuery = useCallback(() => {
    if (preset === 'custom') {
      if (!customStart || !customEnd) return null
      return `period=custom&start=${customStart}&end=${customEnd}`
    }
    return `period=${preset}`
  }, [preset, customStart, customEnd])

  useEffect(() => {
    const query = buildQuery()
    if (!query) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    api.get(`/reports/${activeTab}?${query}`)
      .then((res) => setData(res.data))
      .catch(() => setError('Could not load this report.'))
      .finally(() => setLoading(false))
  }, [activeTab, buildQuery])

  return (
    <AppLayout>
      <header className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-8 overflow-hidden bg-gradient-to-br from-[#1F3A5F] to-[#132840]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="relative px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">Management</span>
          </div>
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[46px]">
            Business Performance Reports
          </h1>
          <p className="mt-3 max-w-xl text-[14px] font-normal leading-6 text-white/50">
            Review how the business has performed over time, and where management should investigate.
          </p>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`
              rounded-xl px-4 py-2.5 text-[13px] font-bold transition-colors
              ${activeTab === tab.key ? 'bg-[#1F3A5F] text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        <PeriodSelector
          preset={preset} setPreset={setPreset}
          customStart={customStart} setCustomStart={setCustomStart}
          customEnd={customEnd} setCustomEnd={setCustomEnd}
          periodEcho={data?.period}
        />
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[120px] animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
          <div className="h-[200px] animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {activeTab === 'executive' && <ExecutivePanel data={data} navigate={navigate} />}
          {activeTab === 'hotel' && <HotelPanel data={data} />}
          {activeTab === 'restaurant' && <RestaurantPanel data={data} />}
          {activeTab === 'delivery' && <DeliveryPanel data={data} />}
          {activeTab === 'inventory' && <InventoryPanel data={data} />}
          {activeTab === 'operations' && <OperationsPanel data={data} />}
        </>
      )}
    </AppLayout>
  )
}