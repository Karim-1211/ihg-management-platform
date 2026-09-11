import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/AppLayout'

const SHADOW_REST = 'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_2px_8px_-2px_rgba(15,23,42,0.06),0_16px_32px_-12px_rgba(15,23,42,0.10)]'
const SHADOW_HOVER = 'shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_-2px_rgba(15,23,42,0.08),0_28px_52px_-14px_rgba(15,23,42,0.16)]'

const STATUS_STYLES = {
  ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  INACTIVE: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
}

function IconShield({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
    </svg>
  )
}
function IconClose({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
function IconClock({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function formatValue(rule) {
  if (rule.value_type === 'PERCENTAGE') return `${(Number(rule.numeric_value) * 100).toFixed(2)}%`
  if (rule.value_type === 'MINUTES') return `${Number(rule.numeric_value)} min`
  return String(Number(rule.numeric_value))
}

function scopeLabel(rule) {
  if (rule.scope_type === 'GLOBAL') return 'Global'
  if (rule.scope_type === 'HOTEL') return 'Hotel'
  return 'Restaurant'
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.INACTIVE
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status === 'ACTIVE' ? 'Active' : 'Inactive'}
    </span>
  )
}

function RuleRow({ rule, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(rule)}
      className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 text-left transition-colors last:border-0 hover:bg-slate-50/70"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-slate-800">{rule.display_name}</p>
        <p className="mt-0.5 text-[12px] font-medium text-slate-400">{scopeLabel(rule)} scope · Priority {rule.priority}</p>
      </div>
      <div className="w-28 shrink-0 text-right text-[16px] font-bold tracking-tight text-slate-900">{formatValue(rule)}</div>
      <div className="w-24 shrink-0"><StatusBadge status={rule.status} /></div>
    </button>
  )
}

function RuleDrawer({ rule, onClose, onSaved }) {
  const [numericValue, setNumericValue] = useState('')
  const [priority, setPriority] = useState(0)
  const [status, setStatus] = useState('ACTIVE')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (!rule) return
    const displayValue = rule.value_type === 'PERCENTAGE' ? (Number(rule.numeric_value) * 100).toFixed(2) : String(Number(rule.numeric_value))
    setNumericValue(displayValue)
    setPriority(rule.priority)
    setStatus(rule.status)
    setReason('')
    setError('')
    api.get(`/business-rules/${rule.id}/history`).then((res) => setHistory(res.data)).catch(() => setHistory([]))
  }, [rule])

  if (!rule) return null

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const rawValue = rule.value_type === 'PERCENTAGE' ? Number(numericValue) / 100 : Number(numericValue)
      await api.patch(`/business-rules/${rule.id}`, {
        version: rule.version,
        numeric_value: rawValue,
        priority: Number(priority),
        status,
        reason: reason || undefined,
      })
      onSaved()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save this policy.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{scopeLabel(rule)} Policy</p>
            <h2 className="mt-1 text-[19px] font-bold tracking-tight text-slate-800">{rule.display_name}</h2>
            {rule.description && <p className="mt-1.5 text-[12.5px] font-medium text-slate-500">{rule.description}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <IconClose />
          </button>
        </div>

        <div className="flex-1 space-y-6 px-6 py-6">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Current Policy</p>
            <p className="text-[28px] font-bold tracking-tight text-slate-900">{formatValue(rule)}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              New Value {rule.value_type === 'PERCENTAGE' ? '(%)' : rule.value_type === 'MINUTES' ? '(minutes)' : ''}
            </label>
            <input
              type="number" step="any" value={numericValue} onChange={(e) => setNumericValue(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[15px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Status</label>
            <div className="flex gap-2">
              {['ACTIVE', 'INACTIVE'].map((s) => (
                <button
                  key={s} type="button" onClick={() => setStatus(s)}
                  className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${status === s ? 'bg-[#1F3A5F] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  {s === 'ACTIVE' ? 'Active' : 'Inactive'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button" onClick={() => setShowAdvanced((v) => !v)}
            className="text-[12px] font-semibold text-[#1F3A5F] hover:underline"
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Priority</label>
                <input
                  type="number" value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20"
                />
                <p className="mt-1 text-[11px] font-medium text-slate-400">Higher priority wins when multiple policies apply at the same scope.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Reason for change (optional)</label>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]/20"
                  placeholder="e.g. Adjusted per updated finance guidance"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
              <p className="text-[12.5px] font-medium text-red-700">{error}</p>
            </div>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              <IconClock className="h-3.5 w-3.5" /> Change History
            </p>
            {history.length === 0 ? (
              <p className="text-[12.5px] font-medium text-slate-400">No changes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-[12px] font-semibold text-slate-600">{h.change_type}</p>
                    <p className="text-[11px] font-medium text-slate-400">{new Date(h.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-6 py-4">
          <button
            type="button" onClick={handleSave} disabled={saving}
            className="w-full rounded-xl bg-[#1F3A5F] px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-[#172F4D] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BusinessRulesPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRule, setSelectedRule] = useState(null)

  function loadRules() {
    setLoading(true)
    setError('')
    api.get('/business-rules')
      .then((res) => setRules(res.data))
      .catch(() => setError('Could not load business rules.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRules() }, [])

  const activeCount = rules.filter((r) => r.status === 'ACTIVE').length
  const scheduledCount = rules.filter((r) => new Date(r.effective_from) > new Date()).length

  const grouped = rules.reduce((acc, r) => {
    const key = scopeLabel(r)
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <AppLayout>
      <header className="relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 mb-8 overflow-hidden bg-gradient-to-br from-[#1F3A5F] to-[#132840]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="relative px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
            <IconShield className="h-3.5 w-3.5 text-white/70" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">Governance</span>
          </div>
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-[46px]">
            Business Rules
          </h1>
          <p className="mt-3 max-w-xl text-[14px] font-normal leading-6 text-white/50">
            Operating policies that govern how the platform behaves — pricing, billing, and operational thresholds.
          </p>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 ${SHADOW_REST}`}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">Active Policies</p>
              <p className="mt-2.5 text-[32px] font-bold leading-none tracking-[-0.02em] text-slate-900">{activeCount}</p>
            </div>
            <div className={`rounded-2xl border border-slate-200/80 bg-white p-5 ${SHADOW_REST}`}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">Scheduled Changes</p>
              <p className="mt-2.5 text-[32px] font-bold leading-none tracking-[-0.02em] text-slate-900">{scheduledCount}</p>
            </div>
            <div className={`col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 lg:col-span-1 ${SHADOW_REST}`}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">Total Policies</p>
              <p className="mt-2.5 text-[32px] font-bold leading-none tracking-[-0.02em] text-slate-900">{rules.length}</p>
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(grouped).map(([group, groupRules]) => (
              <div key={group} className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white ${SHADOW_REST} transition-shadow duration-300 hover:${SHADOW_HOVER}`}>
                <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                  <h2 className="text-[15px] font-bold tracking-tight text-slate-800">{group} Policies</h2>
                </div>
                <div>
                  {groupRules.map((r) => <RuleRow key={r.id} rule={r} onOpen={setSelectedRule} />)}
                </div>
              </div>
            ))}
            {rules.length === 0 && (
              <div className={`rounded-2xl border border-slate-200/80 bg-white p-8 text-center ${SHADOW_REST}`}>
                <p className="text-sm font-medium text-slate-400">No business rules configured yet.</p>
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-[110px] animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
          <div className="h-[220px] animate-pulse rounded-2xl bg-slate-100" />
        </div>
      )}

      <RuleDrawer
        rule={selectedRule}
        onClose={() => setSelectedRule(null)}
        onSaved={() => { setSelectedRule(null); loadRules() }}
      />
    </AppLayout>
  )
}