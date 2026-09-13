import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import ConfirmDialog from '../../components/shared/ConfirmDialog'

const SHADOW_REST = 'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.10)]'

const TABS = [
  { key: 'bookings', label: 'Bookings' },
  { key: 'orders', label: 'Orders' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'service-requests', label: 'Service Requests' },
  { key: 'notifications', label: 'Notifications' },
]

const BOOKING_STATUS_COLORS = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  CHECKED_IN: 'bg-green-100 text-green-700',
  CHECKED_OUT: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const ORDER_STATUS_COLORS = {
  NEW: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-indigo-100 text-indigo-700',
  READY: 'bg-purple-100 text-purple-700',
  SERVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const DELIVERY_STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  PICKED_UP: 'bg-indigo-100 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-purple-100 text-purple-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const RESERVATION_STATUS_COLORS = {
  CONFIRMED: 'bg-blue-100 text-blue-700',
  SEATED: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
  NO_SHOW: 'bg-red-100 text-red-700',
}

const INVOICE_STATUS_COLORS = {
  UNPAID: 'bg-yellow-100 text-yellow-700',
  PARTIALLY_PAID: 'bg-orange-100 text-orange-700',
  PAID: 'bg-green-100 text-green-700',
}

const SERVICE_TYPE_LABELS = {
  ROOM_CLEANING: 'Room Cleaning',
  EXTRA_TOWELS: 'Extra Towels',
  WATER: 'Water',
  FOOD: 'Food',
  AMENITIES: 'Amenities',
  OTHER: 'Other',
}

function Card({ children }) {
  return <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 ${SHADOW_REST}`}>{children}</div>
}

function StatusBadge({ label, colorMap }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorMap[label] || 'bg-gray-100 text-gray-700'}`}>
      {label?.replace(/_/g, ' ')}
    </span>
  )
}

function EmptyState({ text }) {
  return (
    <Card>
      <p className="text-sm text-gray-500 text-center py-4">{text}</p>
    </Card>
  )
}

// ---------- Shared invoice card, used for both Hotel and Restaurant invoices ----------

function InvoiceCard({ invoice, kind, onPaid }) {
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  const payEndpoint = kind === 'hotel' ? `/invoices/${invoice.id}/pay` : `/restaurant-invoices/${invoice.id}/pay`

  async function handlePay() {
    setPaying(true)
    setError('')
    try {
      await api.post(payEndpoint, { payment_method: 'DEMO' })
      onPaid()
    } catch (err) {
      setError(err.response?.data?.detail || 'Payment failed.')
    } finally {
      setPaying(false)
    }
  }

  const subtitle = kind === 'hotel'
    ? `${invoice.booking_reference || ''} · Room ${invoice.room_number || '?'}`
    : `${invoice.order_number || ''}${invoice.table_number ? ` · Table ${invoice.table_number}` : ''}`

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="font-bold text-navy text-lg">{invoice.invoice_number}</p>
          <p className="text-gray-500 text-sm">{subtitle}</p>
          <span className="inline-block mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {kind === 'hotel' ? 'Hotel' : 'Restaurant'}
          </span>
        </div>
        <StatusBadge label={invoice.status} colorMap={INVOICE_STATUS_COLORS} />
      </div>

      <div className="space-y-1.5 text-sm text-gray-600 border-t border-gray-100 pt-4">
        {kind === 'hotel' && invoice.room_charge != null && (
          <div className="flex justify-between"><span>Room charge</span><span>${invoice.room_charge}</span></div>
        )}
        {invoice.service_charge > 0 && (
          <div className="flex justify-between"><span>Service charges</span><span>${invoice.service_charge}</span></div>
        )}
        <div className="flex justify-between"><span>Subtotal</span><span>${invoice.subtotal}</span></div>
        <div className="flex justify-between"><span>Tax</span><span>${invoice.tax_amount}</span></div>
        {invoice.discount_amount > 0 && (
          <div className="flex justify-between text-green-600"><span>Discount</span><span>-${invoice.discount_amount}</span></div>
        )}
        <div className="flex justify-between text-navy font-bold text-base pt-2 border-t border-gray-100">
          <span>Total</span><span>${invoice.total_amount}</span>
        </div>
      </div>

      {error && <p className="text-red-600 text-xs mt-3">{error}</p>}

      {invoice.status !== 'PAID' && (
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full mt-4 py-2.5 bg-red text-white font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
        >
          {paying ? 'Processing...' : 'Pay Now (Demo)'}
        </button>
      )}
    </Card>
  )
}

// ---------- Bookings tab (with inline service-request creation, preserved from MyBookingsPage) ----------

const SERVICE_TYPES = [
  { value: 'ROOM_CLEANING', label: 'Room Cleaning' },
  { value: 'EXTRA_TOWELS', label: 'Extra Towels' },
  { value: 'WATER', label: 'Water' },
  { value: 'FOOD', label: 'Food' },
  { value: 'AMENITIES', label: 'Amenities' },
  { value: 'OTHER', label: 'Other' },
]

function ServiceRequestForm({ bookingId, onSubmitted }) {
  const [requestType, setRequestType] = useState('ROOM_CLEANING')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.post('/service-requests', { booking_id: bookingId, request_type: requestType, description: description || null })
      setDescription('')
      onSubmitted()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Request type</label>
        <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Room 204, need 2 extra towels" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
      </div>
      <button type="submit" disabled={submitting} className="px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy-dark transition-colors disabled:opacity-50">
        {submitting ? 'Sending...' : 'Request'}
      </button>
      {error && <p className="text-red-600 text-xs w-full">{error}</p>}
    </form>
  )
}

function BookingsTab({ bookings, myRequests, onDataChange }) {
  const [openFormFor, setOpenFormFor] = useState(null)
  const [pendingCancel, setPendingCancel] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  async function handleConfirmCancel() {
    if (!pendingCancel) return
    setCancelling(true)
    setCancelError('')
    try {
      await api.post(`/bookings/${pendingCancel.id}/cancel`)
      setPendingCancel(null)
      onDataChange()
    } catch (err) {
      setCancelError(err.response?.data?.detail || 'Could not cancel this booking.')
    } finally {
      setCancelling(false)
    }
  }

  function requestsForBooking(bookingId) {
    return myRequests.filter((r) => r.booking_id === bookingId)
  }

  if (bookings.length === 0) return <EmptyState text="You don't have any bookings yet." />

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <Card key={b.id}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-bold text-navy">{b.booking_reference}</p>
              <p className="text-gray-500 text-sm">{b.check_in_date} → {b.check_out_date} · {b.number_of_guests} guest(s)</p>
              <p className="text-gray-700 font-medium mt-1">${b.total_amount}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge label={b.status} colorMap={BOOKING_STATUS_COLORS} />
              {b.status === 'CHECKED_IN' && (
                <button onClick={() => setOpenFormFor(openFormFor === b.id ? null : b.id)} className="px-4 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-red-dark transition-colors">
                  Request Service
                </button>
              )}
              {(b.status === 'CONFIRMED' || b.status === 'CHECKED_IN') && (
                <button
                  onClick={() => { setCancelError(''); setPendingCancel(b) }}
                  className="px-4 py-1.5 border border-red text-red text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>

          {requestsForBooking(b.id).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              {requestsForBooking(b.id).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {SERVICE_TYPE_LABELS[r.request_type] || r.request_type}
                    {r.description ? ` — ${r.description}` : ''}
                    {r.price ? ` (+$${r.price})` : ''}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{r.status}</span>
                </div>
              ))}
            </div>
          )}

          {openFormFor === b.id && (
            <ServiceRequestForm bookingId={b.id} onSubmitted={() => { setOpenFormFor(null); onDataChange() }} />
          )}
        </Card>
      ))}

      {cancelError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {cancelError}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingCancel}
        title="Cancel this booking?"
        message={pendingCancel ? `This will cancel booking ${pendingCancel.booking_reference}. This cannot be undone, and is subject to the cancellation policy.` : ''}
        confirmLabel={cancelling ? 'Cancelling...' : 'Cancel Booking'}
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  )
}

// ---------- Orders tab (now with delivery enrichment) ----------

function OrdersTab({ orders }) {
  if (orders.length === 0) return <EmptyState text="You haven't placed any orders yet." />

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <p className="font-bold text-navy">{order.order_number}</p>
              <p className="text-gray-500 text-sm">
                {order.order_type.replace('_', ' ')} {order.table_number ? `· Table ${order.table_number}` : ''}
              </p>
            </div>
            <StatusBadge label={order.status} colorMap={ORDER_STATUS_COLORS} />
          </div>

          {order.order_type === 'DELIVERY' && order.delivery_status && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Delivery</span>
              <StatusBadge label={order.delivery_status} colorMap={DELIVERY_STATUS_COLORS} />
              {order.delivery_driver_name && (
                <span className="text-xs text-slate-500">· {order.delivery_driver_name}</span>
              )}
            </div>
          )}

          <div className="space-y-1 text-sm text-gray-600 border-t border-gray-100 pt-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>{item.quantity} × {item.menu_item_name || 'Item'}</span>
                <span>${item.subtotal}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between font-bold text-navy pt-3 mt-3 border-t border-gray-100">
            <span>Total</span><span>${order.total_amount}</span>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------- Reservations tab ----------

function ReservationsTab({ reservations, onCancel }) {
  const [cancelingId, setCancelingId] = useState(null)
  const [pendingCancel, setPendingCancel] = useState(null)
  const [cancelError, setCancelError] = useState('')

  async function handleConfirmCancel() {
    if (!pendingCancel) return
    setCancelingId(pendingCancel.id)
    setCancelError('')
    try {
      await api.post(`/reservations/${pendingCancel.id}/cancel`)
      setPendingCancel(null)
      onCancel()
    } catch (err) {
      setCancelError(err.response?.data?.detail || 'Could not cancel this reservation.')
    } finally {
      setCancelingId(null)
    }
  }

  if (reservations.length === 0) return <EmptyState text="No reservations yet." />

  return (
    <div className="space-y-4">
      {reservations.map((r) => (
        <Card key={r.id}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-bold text-navy">{r.restaurant_name} · Table {r.table_number}</p>
              <p className="text-gray-500 text-sm">{new Date(r.reservation_start).toLocaleString()} · Party of {r.party_size}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge label={r.status} colorMap={RESERVATION_STATUS_COLORS} />
              {r.status === 'CONFIRMED' && (
                <button
                  onClick={() => { setCancelError(''); setPendingCancel(r) }}
                  disabled={cancelingId === r.id}
                  className="px-3 py-1.5 bg-red text-white text-xs font-semibold rounded-lg hover:bg-red-dark transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </Card>
      ))}

      {cancelError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {cancelError}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingCancel}
        title="Cancel this reservation?"
        message={pendingCancel ? `This will cancel your table reservation at ${pendingCancel.restaurant_name} (Table ${pendingCancel.table_number}, ${new Date(pendingCancel.reservation_start).toLocaleString()}). This cannot be undone.` : ''}
        confirmLabel={cancelingId ? 'Cancelling...' : 'Cancel Reservation'}
        destructive
        onConfirm={handleConfirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  )
}

// ---------- Invoices tab (merged Hotel + Restaurant) ----------

function InvoicesTab({ hotelInvoices, restaurantInvoices, onPaid }) {
  const all = [
    ...hotelInvoices.map((i) => ({ ...i, kind: 'hotel' })),
    ...restaurantInvoices.map((i) => ({ ...i, kind: 'restaurant' })),
  ].sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))

  if (all.length === 0) return <EmptyState text="No invoices yet." />

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {all.map((inv) => <InvoiceCard key={inv.id} invoice={inv} kind={inv.kind} onPaid={onPaid} />)}
    </div>
  )
}

// ---------- Service Requests tab (standalone view of the same data used in Bookings tab) ----------

function ServiceRequestsTab({ myRequests }) {
  if (myRequests.length === 0) return <EmptyState text="You haven't made any service requests yet." />

  return (
    <div className="space-y-3">
      {myRequests.map((r) => (
        <Card key={r.id}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-navy">{SERVICE_TYPE_LABELS[r.request_type] || r.request_type}</p>
              {r.description && <p className="text-sm text-gray-500">{r.description}</p>}
              {r.booking_reference && <p className="text-xs text-gray-400 mt-1">Booking {r.booking_reference}</p>}
            </div>
            <div className="flex items-center gap-2">
              {r.price != null && <span className="text-sm font-medium text-gray-600">${r.price}</span>}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{r.status}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---------- Notifications tab (persistent history, paginated) ----------

const NOTIFICATION_TAB_MAP = {
  booking: 'bookings',
  service_request: 'service-requests',
  order: 'orders',
  delivery: 'orders',
  invoice: 'invoices',
  payment: 'invoices',
}

function NotificationsTab({ onNavigateToTab }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20

  function loadPage(pageNum) {
    setLoading(true)
    api.get(`/notifications?limit=${PAGE_SIZE}&offset=${pageNum * PAGE_SIZE}`)
      .then((res) => {
        setNotifications((prev) => (pageNum === 0 ? res.data : [...prev, ...res.data]))
        setHasMore(res.data.length === PAGE_SIZE)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPage(0) }, [])

  function loadMore() {
    const next = page + 1
    setPage(next)
    loadPage(next)
  }

    async function handleNotificationClick(n) {
    if (n.status !== 'READ') {
      api.patch(`/notifications/${n.id}/read`).catch(() => {})
      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, status: 'READ' } : item)))
    }
    const targetTab = NOTIFICATION_TAB_MAP[n.related_entity_type]
    if (targetTab && onNavigateToTab) onNavigateToTab(targetTab)
  }

  if (loading && notifications.length === 0) return <p className="text-gray-500">Loading...</p>
  if (!loading && notifications.length === 0) return <EmptyState text="No notifications yet." />

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Card key={n.id}>
          <button type="button" onClick={() => handleNotificationClick(n)} className="flex w-full items-start justify-between gap-3 text-left">
            <div>
              <p className={`text-sm ${n.status !== 'READ' ? 'font-bold text-navy' : 'font-medium text-gray-600'}`}>{n.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
            {n.status !== 'READ' && <span className="w-2 h-2 rounded-full bg-red shrink-0 mt-1.5" />}
          </button>
        </Card>
      ))}
      {hasMore && (
        <button onClick={loadMore} disabled={loading} className="w-full py-2.5 text-sm font-semibold text-navy hover:underline disabled:opacity-50">
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

// ---------- Main page ----------

const VALID_TAB_KEYS = TABS.map((t) => t.key)

export default function MyAccountPage() {
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const initialTab = VALID_TAB_KEYS.includes(requestedTab) ? requestedTab : 'bookings'

  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [bookings, setBookings] = useState([])
  const [orders, setOrders] = useState([])
  const [reservations, setReservations] = useState([])
  const [hotelInvoices, setHotelInvoices] = useState([])
  const [restaurantInvoices, setRestaurantInvoices] = useState([])
  const [myRequests, setMyRequests] = useState([])

  function loadAll() {
    setLoading(true)
    setError('')
    Promise.all([
      api.get('/bookings/my'),
      api.get('/orders/my'),
      api.get('/reservations/my'),
      api.get('/invoices/my'),
      api.get('/restaurant-invoices/my'),
      api.get('/service-requests/my'),
    ])
      .then(([b, o, r, hi, ri, sr]) => {
        setBookings(b.data)
        setOrders(o.data)
        setReservations(r.data)
        setHotelInvoices(hi.data)
        setRestaurantInvoices(ri.data)
        setMyRequests(sr.data)
      })
      .catch(() => setError('Could not load your account data.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  const tabCounts = {
    bookings: bookings.length,
    orders: orders.length,
    reservations: reservations.length,
    invoices: hotelInvoices.length + restaurantInvoices.length,
    'service-requests': myRequests.length,
  }

  return (
    <AppLayout>
      <header className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-8 overflow-hidden bg-gradient-to-br from-[#1F3A5F] to-[#132840]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="relative px-4 py-10 sm:px-6 lg:px-8">
          <h1 className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:text-[40px]">
            My Account
          </h1>
          <p className="mt-2 max-w-xl text-[14px] font-normal leading-6 text-white/50">
            Everything about your stays, orders, and bills, in one place.
          </p>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
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
            {tabCounts[tab.key] > 0 && (
              <span className={`ml-1.5 ${activeTab === tab.key ? 'text-white/70' : 'text-slate-400'}`}>{tabCounts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {activeTab === 'bookings' && <BookingsTab bookings={bookings} myRequests={myRequests} onDataChange={loadAll} />}
          {activeTab === 'orders' && <OrdersTab orders={orders} />}
          {activeTab === 'reservations' && <ReservationsTab reservations={reservations} onCancel={loadAll} />}
          {activeTab === 'invoices' && <InvoicesTab hotelInvoices={hotelInvoices} restaurantInvoices={restaurantInvoices} onPaid={loadAll} />}
          {activeTab === 'service-requests' && <ServiceRequestsTab myRequests={myRequests} />}
          {activeTab === 'notifications' && <NotificationsTab onNavigateToTab={setActiveTab} />}
        </>
      )}
    </AppLayout>
  )
}