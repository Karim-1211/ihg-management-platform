import { useState } from 'react'
import api from '../../services/api'

// A guest who has a code wants to use it; a guest who doesn't shouldn't have
// an empty box nagging at them. So it stays a quiet link until opened.
//
// `tone` matters: the delivery checkout places this on white, the hotel
// summary places it on navy. One palette cannot serve both — dark text on a
// dark panel is invisible.
export default function PromoCodeField({ scope, subtotal, applied, onApply, onRemove, tone = 'light' }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const onDark = tone === 'dark'

  async function check(e) {
    // Both stopPropagation and preventDefault matter: this field sits inside
    // the booking form, and without them Enter submits THAT form instead,
    // reloading the page mid-checkout.
    e?.preventDefault()
    e?.stopPropagation()

    const cleaned = code.trim().toUpperCase()
    if (!cleaned) return

    // The server rejects a zero subtotal outright, which surfaced as an
    // unexplained 422. Say plainly what is missing instead.
    const amount = Number(subtotal)
    if (!amount || amount <= 0) {
      setError('Choose your dates first, so we can work out the saving.')
      return
    }

    setChecking(true)
    setError('')
    try {
      const res = await api.post('/promo/preview', {
        code: cleaned,
        scope,
        subtotal: amount,
      })
      onApply(res.data)
      setCode('')
      setOpen(false)
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? 'That code could not be checked — please check your dates and try again.'
            : 'We could not check that code.'
      )
    } finally {
      setChecking(false)
    }
  }

  if (applied) {
    return (
      <div className={`mt-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
        onDark ? 'bg-white/10 ring-1 ring-white/20' : 'border border-emerald-200 bg-emerald-50'
      }`}>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${onDark ? 'text-white' : 'text-emerald-800'}`}>{applied.code} applied</p>
          <p className={`text-xs ${onDark ? 'text-white/60' : 'text-emerald-700'}`}>{applied.label}</p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className={`shrink-0 text-xs font-semibold underline ${onDark ? 'text-white/70 hover:text-white' : 'text-emerald-700 hover:text-emerald-900'}`}
        >
          Remove
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-4 text-sm font-bold underline-offset-4 hover:underline ${onDark ? 'text-[#FF8FA3]' : 'text-[#FF2147]'}`}
      >
        Have a promotional code?
      </button>
    )
  }

  return (
    <div className="mt-4">
      <label className="block">
        <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${onDark ? 'text-[#FF8FA3]' : 'text-[#FF2147]'}`}>
          Promotional code
        </span>
        <div className="mt-2 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              e.stopPropagation()
              check(e)
            }}
            placeholder="IHG······"
            maxLength={32}
            autoFocus
            className={`min-w-0 flex-1 rounded-xl px-4 py-2.5 text-sm font-bold tracking-[0.12em] outline-none transition ${
              onDark
                ? 'border border-white/25 bg-white text-[#1F3A5F] placeholder-slate-400 focus:border-white'
                : 'border border-slate-300 bg-white text-[#1F3A5F] placeholder-slate-400 focus:border-[#1F3A5F]'
            }`}
          />
          <button
            type="button"
            onClick={check}
            disabled={checking || !code.trim()}
            className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-bold transition disabled:opacity-40 ${
              onDark ? 'bg-[#FF2147] text-white hover:bg-[#dc1539]' : 'bg-[#1F3A5F] text-white hover:bg-[#162f4d]'
            }`}
          >
            {checking ? 'Checking…' : 'Apply'}
          </button>
        </div>
      </label>
      {error && <p className={`mt-2 text-xs font-semibold ${onDark ? 'text-[#FF8FA3]' : 'text-red-600'}`}>{error}</p>}
    </div>
  )
}