import { useSyncExternalStore } from 'react'
import api from '../services/api'

// One basket for the whole delivery journey — menu, checkout, "order
// again" and Alice all read and write the same store. Saved in the browser
// so it survives a refresh and the sign-in redirect at checkout.
const STORAGE_KEY = 'ihg_delivery_cart_v1'
const MAX_QTY = 50
const EMPTY = Object.freeze({ restaurantId: null, items: {} })
const listeners = new Set()

function sanitize(items) {
  const out = {}
  for (const [id, qty] of Object.entries(items || {})) {
    const n = Math.floor(Number(qty))
    if (id && n > 0) out[id] = Math.min(n, MAX_QTY)
  }
  return out
}

function read() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw)
    const items = sanitize(parsed?.items)
    return Object.keys(items).length ? { restaurantId: parsed.restaurantId || null, items } : EMPTY
  } catch {
    return EMPTY
  }
}

let state = typeof window === 'undefined' ? EMPTY : read()

function commit(next) {
  state = next
  try {
    if (Object.keys(next.items).length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode) — the basket still works for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      state = read()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function getDeliveryCart() {
  return state
}

export function useDeliveryCart() {
  return useSyncExternalStore(subscribe, getDeliveryCart, getDeliveryCart)
}

export function cartCount(cart) {
  return Object.values(cart?.items || {}).reduce((sum, qty) => sum + qty, 0)
}

// A basket belongs to one restaurant. Adding from a different restaurant
// starts a fresh basket rather than silently mixing kitchens.
export function setItemQuantity(restaurantId, itemId, quantity) {
  const base = state.restaurantId === restaurantId ? state.items : {}
  const items = { ...base }
  const n = Math.max(0, Math.min(MAX_QTY, Math.floor(Number(quantity) || 0)))
  if (n === 0) delete items[itemId]
  else items[itemId] = n
  commit(Object.keys(items).length ? { restaurantId, items } : EMPTY)
}

export function addItemsToCart(restaurantId, itemMap, { replace = false } = {}) {
  const base = !replace && state.restaurantId === restaurantId ? state.items : {}
  const items = { ...base }
  for (const [id, qty] of Object.entries(itemMap || {})) {
    items[id] = (items[id] || 0) + Math.floor(Number(qty) || 0)
  }
  const clean = sanitize(items)
  commit(Object.keys(clean).length ? { restaurantId, items: clean } : EMPTY)
}

export function removeItemsFromCart(itemIds) {
  const items = { ...state.items }
  itemIds.forEach((id) => { delete items[String(id)] })
  commit(Object.keys(items).length ? { restaurantId: state.restaurantId, items } : EMPTY)
}

export function clearDeliveryCart() {
  commit(EMPTY)
}

// "Order again" only re-adds dishes that are on the menu TODAY — never a
// blind copy of an old order that might include retired dishes.
export async function reorderIntoCart(order) {
  const res = await api.get(`/restaurants/${order.restaurant_id}/menu`)
  const available = new Set(
    (res.data || []).flatMap((c) => (c.items || []).filter((i) => i.is_available).map((i) => i.id))
  )
  const map = {}
  let skipped = 0
  for (const line of order.items || []) {
    if (available.has(line.menu_item_id)) map[line.menu_item_id] = (map[line.menu_item_id] || 0) + line.quantity
    else skipped += 1
  }
  if (Object.keys(map).length) addItemsToCart(order.restaurant_id, map, { replace: true })
  return { added: Object.keys(map).length, skipped }
}