import { useEffect, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const TYPE_LABELS = {
  BOOKING_CONFIRMED: 'Booking Confirmed',
  BOOKING_CANCELLED: 'Booking Cancelled',
  CHECK_IN_COMPLETED: 'Check-In Completed',
  CHECK_OUT_COMPLETED: 'Check-Out Completed',
  SERVICE_REQUEST_CREATED: 'Service Request Created',
  SERVICE_REQUEST_COMPLETED: 'Service Request Completed',
  ORDER_CREATED: 'Order Created',
  ORDER_READY: 'Order Ready',
  ORDER_SERVED: 'Order Served',
  DELIVERY_ASSIGNED: 'Delivery Assigned',
  DELIVERY_OUT_FOR_DELIVERY: 'Delivery Out For Delivery',
  DELIVERY_DELIVERED: 'Delivery Delivered',
  INVOICE_CREATED: 'Invoice Created',
  PAYMENT_COMPLETED: 'Payment Completed',
  PAYMENT_FAILED: 'Payment Failed',
  LOW_STOCK_ALERT: 'Low Stock Alert',
}

const MANDATORY_TYPES = new Set(['INVOICE_CREATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED'])

export default function NotificationPreferencesPage() {
  const [preferences, setPreferences] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingType, setSavingType] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPreferences()
  }, [])

  function loadPreferences() {
    setLoading(true)
    api.get('/notifications/preferences')
      .then((res) => setPreferences(res.data))
      .catch(() => setError('Could not load preferences.'))
      .finally(() => setLoading(false))
  }

  async function handleToggle(notificationType, currentValue) {
    if (MANDATORY_TYPES.has(notificationType)) return
    setError('')
    setSavingType(notificationType)
    try {
      await api.put('/notifications/preferences', {
        notification_type: notificationType,
        email_enabled: !currentValue,
      })
      setPreferences((prev) =>
        prev.map((p) =>
          p.notification_type === notificationType ? { ...p, email_enabled: !currentValue } : p
        )
      )
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update preference.')
    } finally {
      setSavingType(null)
    }
  }

  return (
    <AppLayout>
      <h1 className="text-2xl font-bold text-navy mb-2">Notification Settings</h1>
      <p className="text-gray-500 mb-6">
        In-app notifications are always on for relevant events. Choose which ones also send an email.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && (
        <div className="bg-white rounded-2xl shadow-md divide-y divide-gray-100">
          {preferences.map((pref) => {
            const isMandatory = MANDATORY_TYPES.has(pref.notification_type)
            const isSaving = savingType === pref.notification_type
            return (
              <div key={pref.notification_type} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-navy">
                    {TYPE_LABELS[pref.notification_type] || pref.notification_type}
                  </p>
                  {isMandatory && (
                    <p className="text-xs text-gray-400 mt-0.5">Always sent — cannot be disabled</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isMandatory || isSaving}
                  onClick={() => handleToggle(pref.notification_type, pref.email_enabled)}
                  className={`
                    relative w-11 h-6 rounded-full transition-colors shrink-0
                    ${pref.email_enabled ? 'bg-red' : 'bg-gray-300'}
                    ${isMandatory ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                  aria-label={`Toggle email for ${TYPE_LABELS[pref.notification_type]}`}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
                      ${pref.email_enabled ? 'translate-x-5' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </AppLayout>
  )
}