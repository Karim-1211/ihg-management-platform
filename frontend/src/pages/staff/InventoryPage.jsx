import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const TRANSACTION_TYPES = [
  { value: 'PURCHASE', label: 'Purchase — stock in', direction: 'in' },
  { value: 'RETURN', label: 'Return — stock in', direction: 'in' },
  { value: 'WASTE', label: 'Waste — stock out', direction: 'out' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Correction — stock out', direction: 'out' },
  { value: 'SERVICE_USAGE', label: 'Service usage — stock out', direction: 'out' },
]

const TYPE_STYLE = {
  ORDER_USAGE: 'bg-[#FF2147]/10 text-[#FF2147]',
  PURCHASE: 'bg-emerald-50 text-emerald-700',
  RETURN: 'bg-emerald-50 text-emerald-700',
  WASTE: 'bg-amber-50 text-amber-700',
  MANUAL_ADJUSTMENT: 'bg-slate-100 text-slate-600',
  SERVICE_USAGE: 'bg-indigo-50 text-indigo-700',
}

const SORTS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'low', label: 'Lowest stock first' },
  { value: 'recent', label: 'Recently updated' },
]

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    box: (<><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>),
    alert: (<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></>),
    plus: (<path d="M12 5v14M5 12h14" />),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function formatWhen(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function StockBar({ item }) {
  const current = Number(item.current_quantity)
  const minimum = Number(item.minimum_quantity) || 1
  // Full bar = three times the reorder threshold, a readable "healthy" mark.
  const pct = Math.max(2, Math.min(100, (current / (minimum * 3)) * 100))
  const tone = item.is_low_stock ? 'bg-[#FF2147]' : pct < 50 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function AdjustStockForm({ item, onDone }) {
  const [type, setType] = useState('PURCHASE')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!quantity || Number(quantity) <= 0) {
      setError('Enter a quantity greater than 0.')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/inventory/items/${item.id}/transactions`, {
        transaction_type: type,
        quantity: Number(quantity),
        notes: notes || null,
      })
      setQuantity('')
      setNotes('')
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not record that movement.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-[1.3fr_.7fr_1.5fr_auto]">
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Movement</span>
        <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]">
          {TRANSACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Qty ({item.unit})</span>
        <input type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Note (optional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Spoiled, delivery from supplier…" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
      </label>
      <button type="submit" disabled={submitting} className="self-end rounded-lg bg-[#1F3A5F] px-5 py-2 text-sm font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">
        {submitting ? 'Saving…' : 'Record'}
      </button>
      {error && <p className="text-xs text-red-600 sm:col-span-4">{error}</p>}
    </form>
  )
}

function ItemHistory({ item, refreshKey }) {
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setHistory(null)
    setError('')
    api.get(`/inventory/items/${item.id}/transactions`)
      .then((res) => { if (!cancelled) setHistory(Array.isArray(res.data) ? res.data : []) })
      // Without this the panel sat on "Loading history…" forever whenever
      // the request failed — which is exactly what a 403 looked like.
      .catch((err) => {
        if (cancelled) return
        setError(
          err.response?.status === 403
            ? "You don't have permission to view this item's history."
            : err.response?.data?.detail || 'Could not load the stock history.'
        )
      })
    return () => { cancelled = true }
  }, [item.id, refreshKey])

  if (error) return <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
  if (history === null) return <p className="mt-4 text-xs text-slate-400">Loading history…</p>
  if (!history.length) return <p className="mt-4 text-xs text-slate-400">No stock movements recorded yet.</p>

  return (
    <div className="mt-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Stock movements</p>
      <div className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {history.map((h) => {
          const delta = Number(h.quantity_after) - Number(h.quantity_before)
          return (
            <div key={h.id} className="flex items-start justify-between gap-4 rounded-lg px-3 py-2 text-xs hover:bg-slate-50">
              <div className="min-w-0">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${TYPE_STYLE[h.transaction_type] || 'bg-slate-100 text-slate-600'}`}>
                  {h.transaction_type.replace(/_/g, ' ')}
                </span>
                {h.notes && <span className="ml-2 text-slate-500">{h.notes}</span>}
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  {formatWhen(h.created_at)}{h.created_by_name ? ` · ${h.created_by_name}` : ''}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <span className={`font-bold ${delta >= 0 ? 'text-emerald-600' : 'text-[#FF2147]'}`}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(3).replace(/\.?0+$/, '')}
                </span>
                <span className="block text-[11px] text-slate-400">{h.quantity_before} → {h.quantity_after} {item.unit}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CreateItemForm({ scopeType, scopeId, onDone }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [quantity, setQuantity] = useState('')
  const [minimum, setMinimum] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.post('/inventory/items', {
        [scopeType === 'hotel' ? 'hotel_id' : 'restaurant_id']: scopeId,
        name,
        unit,
        current_quantity: Number(quantity) || 0,
        minimum_quantity: Number(minimum) || 0,
      })
      setName(''); setUnit(''); setQuantity(''); setMinimum('')
      setOpen(false)
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create that item.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-[#FF2147] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#dc1539]">
        <Icon name="plus" /> New item
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid w-full gap-3 rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 sm:grid-cols-[1.6fr_.7fr_.8fr_.8fr_auto]">
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Item name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Unit</span>
        <input required value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, L, pcs" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Starting qty</span>
        <input type="number" step="0.001" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Reorder at</span>
        <input type="number" step="0.001" min="0" value={minimum} onChange={(e) => setMinimum(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]" />
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={submitting} className="rounded-lg bg-[#FF2147] px-4 py-2 text-sm font-bold text-white hover:bg-[#dc1539] disabled:opacity-50">
          {submitting ? 'Adding…' : 'Add'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-600 sm:col-span-5">{error}</p>}
    </form>
  )
}

export default function InventoryPage() {
  const { user } = useAuth()
  const [scopeType, setScopeType] = useState('restaurant')
  const [scopeOptions, setScopeOptions] = useState([])
  const [scopeId, setScopeId] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [sort, setSort] = useState('name')
  const [refreshKey, setRefreshKey] = useState(0)

  const isFlexibleRole = ['SUPER_ADMIN', 'MANAGER'].includes(user?.role)
  const isHotelScoped = ['RECEPTIONIST', 'HOUSEKEEPING'].includes(user?.role)
  const isRestaurantScoped = ['KITCHEN', 'WAITER'].includes(user?.role)
  const canCreate = isFlexibleRole

  useEffect(() => {
    if (isHotelScoped) {
      setScopeType('hotel')
      setScopeId(user.hotel_id || '')
      setLoading(false)
    } else if (isRestaurantScoped) {
      setScopeType('restaurant')
      setScopeId(user.restaurant_id || '')
      setLoading(false)
    } else if (isFlexibleRole) {
      api.get('/restaurants')
        .then((res) => {
          setScopeOptions(res.data)
          if (res.data.length > 0) setScopeId(res.data[0].id)
        })
        .catch(() => setError('Could not load the restaurant list.'))
        .finally(() => setLoading(false))
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scopeId) return
    loadItems()
  }, [scopeId, scopeType]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadItems() {
    const url = scopeType === 'hotel' ? `/inventory/hotel/${scopeId}` : `/inventory/restaurant/${scopeId}`
    setError('')
    api.get(url)
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load inventory.'))
  }

  function afterChange() {
    loadItems()
    setRefreshKey((n) => n + 1)
  }

  async function handleScopeTypeSwitch(newType) {
    setScopeType(newType)
    setScopeId('')
    setItems([])
    const res = await api.get(newType === 'restaurant' ? '/restaurants' : '/hotels')
    setScopeOptions(res.data)
    if (res.data.length > 0) setScopeId(res.data[0].id)
  }

  const query = search.trim().toLowerCase()

  const visible = useMemo(() => {
    let list = items.filter((i) => {
      if (lowOnly && !i.is_low_stock) return false
      if (!query) return true
      return `${i.name} ${i.unit}`.toLowerCase().includes(query)
    })
    list = [...list]
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'low') {
      // Ratio to the reorder point, so a 2 kg item at threshold 5 outranks a
      // 30 kg item at threshold 10 — urgency, not raw quantity.
      const ratio = (i) => Number(i.current_quantity) / (Number(i.minimum_quantity) || 1)
      list.sort((a, b) => ratio(a) - ratio(b))
    }
    if (sort === 'recent') list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    return list
  }, [items, query, lowOnly, sort])

  const lowCount = items.filter((i) => i.is_low_stock).length

  if (!isFlexibleRole && !scopeId) {
    return (
      <AppLayout>
        <div className="py-16 text-center">
          <h2 className="mb-2 text-xl font-bold text-[#1F3A5F]">Not assigned</h2>
          <p className="text-slate-500">Your account isn't assigned to a hotel or restaurant yet.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">Inventory</h1>
          <p className="mt-1 text-slate-500">Stock levels, movements and reorder alerts</p>
        </div>
        {canCreate && scopeId && <CreateItemForm scopeType={scopeType} scopeId={scopeId} onDone={afterChange} />}
      </div>

      {items.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
            <div className="flex items-center gap-2 text-slate-400"><Icon name="box" /><span className="text-[11px] font-bold uppercase tracking-[0.12em]">Items tracked</span></div>
            <p className="mt-1 text-2xl font-bold text-[#1F3A5F]">{items.length}</p>
          </div>
          <button
            type="button"
            onClick={() => setLowOnly((v) => !v)}
            className={`rounded-2xl p-4 text-left ring-1 transition ${lowOnly ? 'bg-[#FF2147] text-white ring-[#FF2147]' : 'bg-white ring-slate-200/80 hover:ring-[#FF2147]/40'}`}
          >
            <div className={`flex items-center gap-2 ${lowOnly ? 'text-white/70' : 'text-slate-400'}`}>
              <Icon name="alert" /><span className="text-[11px] font-bold uppercase tracking-[0.12em]">Need reordering</span>
            </div>
            <p className={`mt-1 text-2xl font-bold ${lowOnly ? 'text-white' : lowCount ? 'text-[#FF2147]' : 'text-[#1F3A5F]'}`}>{lowCount}</p>
            <p className={`mt-0.5 text-[11px] ${lowOnly ? 'text-white/70' : 'text-slate-400'}`}>{lowOnly ? 'Showing only these — tap to clear' : 'Tap to filter'}</p>
          </button>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Sort by</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1F3A5F]">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ingredients — chicken, saffron, rice…"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1F3A5F]"
          />
        </div>

        {isFlexibleRole && (
          <>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Scope</span>
              <select value={scopeType} onChange={(e) => handleScopeTypeSwitch(e.target.value)} className="mt-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
                <option value="restaurant">Restaurant</option>
                <option value="hotel">Hotel</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{scopeType === 'hotel' ? 'Hotel' : 'Restaurant'}</span>
              <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="mt-1 min-w-[200px] rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
                {scopeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-slate-200/80">
          <p className="font-semibold text-[#1F3A5F]">No inventory items yet.</p>
          <p className="mt-1 text-sm text-slate-500">Run <code className="rounded bg-slate-100 px-1.5 py-0.5">python seed_inventory_and_recipes.py</code> to stock the pantry.</p>
        </div>
      )}

      {!loading && items.length > 0 && visible.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-200/80">
          <p className="text-sm text-slate-500">Nothing matches that filter.</p>
          <button type="button" onClick={() => { setSearch(''); setLowOnly(false) }} className="mt-3 text-sm font-bold text-[#1F3A5F] underline">Clear filters</button>
        </div>
      )}

      {visible.length > 0 && (
        <p className="mb-3 text-xs text-slate-400">Showing {visible.length} of {items.length} items</p>
      )}

      <div className="space-y-3">
        {visible.map((item) => {
          const open = expandedId === item.id
          return (
            <div key={item.id} className={`rounded-2xl bg-white p-5 ring-1 transition ${item.is_low_stock ? 'ring-[#FF2147]/35' : 'ring-slate-200/80'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-bold text-[#1F3A5F]">{item.name}</p>
                    {item.is_low_stock && (
                      <span className="rounded-full bg-[#FF2147]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#FF2147]">Reorder</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{item.current_quantity} {item.unit}</span> in stock · reorder at {item.minimum_quantity} {item.unit}
                  </p>
                  <StockBar item={item} />
                </div>
                <button
                  onClick={() => setExpandedId(open ? null : item.id)}
                  className={`shrink-0 rounded-lg px-4 py-2 text-xs font-bold transition ${open ? 'bg-[#1F3A5F] text-white' : 'bg-slate-100 text-[#1F3A5F] hover:bg-slate-200'}`}
                >
                  {open ? 'Close' : 'Manage'}
                </button>
              </div>

              {open && (
                <div className="mt-5 border-t border-slate-100 pt-5">
                  <AdjustStockForm item={item} onDone={afterChange} />
                  <ItemHistory item={item} refreshKey={refreshKey} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppLayout>
  )
}