// Combines the kitchen's order status with the delivery record's status
// into the six steps a guest actually cares about. Every step maps to a
// real backend state — nothing here is estimated or invented.
export const DELIVERY_STEPS = [
  { key: 'placed', label: 'Order placed', detail: 'We have your order and your payment.' },
  { key: 'confirmed', label: 'Confirmed', detail: 'The kitchen has accepted your order.' },
  { key: 'preparing', label: 'Preparing', detail: 'Your food is being cooked to order.' },
  { key: 'ready', label: 'Ready', detail: 'Packed and waiting for your rider.' },
  { key: 'onTheWay', label: 'On the way', detail: 'Your rider is heading to you.' },
  { key: 'delivered', label: 'Delivered', detail: 'Enjoy your meal.' },
]

const HEADLINES = [
  "We've received your order.",
  'The kitchen has confirmed your order.',
  'Your food is being prepared.',
  'Your order is ready for its rider.',
  'Your order is on its way.',
  'Delivered — enjoy your meal.',
]

export function isCancelled(order) {
  return order?.status === 'CANCELLED' || order?.delivery_status === 'CANCELLED'
}

export function deliveryStepIndex(order) {
  if (!order || isCancelled(order)) return -1
  if (order.delivery_status === 'DELIVERED' || order.status === 'SERVED') return 5
  if (order.delivery_status === 'PICKED_UP' || order.delivery_status === 'OUT_FOR_DELIVERY') return 4
  if (order.status === 'READY') return 3
  if (order.status === 'PREPARING') return 2
  if (order.status === 'CONFIRMED') return 1
  return 0
}

export function isFinished(order) {
  const index = deliveryStepIndex(order)
  return index === -1 || index === 5
}

export function statusLabel(order) {
  const index = deliveryStepIndex(order)
  return index === -1 ? 'Cancelled' : DELIVERY_STEPS[index].label
}

export function statusHeadline(order) {
  const index = deliveryStepIndex(order)
  return index === -1 ? 'This order was cancelled.' : HEADLINES[index]
}

export function statusPillClass(order) {
  const index = deliveryStepIndex(order)
  if (index === -1) return 'bg-slate-100 text-slate-500'
  if (index === 5) return 'bg-emerald-50 text-emerald-700'
  if (index === 4) return 'bg-[#FF2147]/10 text-[#FF2147]'
  return 'bg-[#1F3A5F]/10 text-[#1F3A5F]'
}

export function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

export function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function summariseItems(order, max = 3) {
  const items = order?.items || []
  const shown = items.slice(0, max).map((i) => `${i.quantity} × ${i.menu_item_name || 'Item'}`)
  const extra = items.length - shown.length
  return extra > 0 ? `${shown.join(', ')} and ${extra} more` : shown.join(', ')
}