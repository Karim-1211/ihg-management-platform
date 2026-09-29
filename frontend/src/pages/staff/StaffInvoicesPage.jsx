import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'
import { downloadPdf, printPdf } from '../../lib/pdfDownload'

const STATUS_STYLE = {
  UNPAID: 'bg-amber-50 text-amber-700',
  PARTIALLY_PAID: 'bg-indigo-50 text-indigo-700',
  PAID: 'bg-emerald-50 text-emerald-700',
}

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'PARTIALLY_PAID', label: 'Part paid' },
  { value: 'PAID', label: 'Paid' },
]

const RANGES = [
  { value: 'all', label: 'All time' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    download: (<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 19h16" /></>),
    print: (<><path d="M6 9V3h12v6" /><path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6z" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function RowActions({ invoiceId, invoiceNumber }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  async function run(kind) {
    setBusy(kind)
    setError('')
    try {
      const path = `/invoices/${invoiceId}/pdf`
      if (kind === 'download') await downloadPdf(path, `${invoiceNumber}.pdf`)
      else await printPdf(path)
    } catch {
      setError('Failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={() => run('download')}
        disabled={busy}
        title="Download PDF"
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-[#1F3A5F] transition hover:border-[#1F3A5F]/40 hover:bg-slate-50 disabled:opacity-50"
      >
        <Icon name="download" className="h-3.5 w-3.5" />
        {busy === 'download' ? '…' : 'PDF'}
      </button>
      <button
        type="button"
        onClick={() => run('print')}
        disabled={busy}
        title="Print"
        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-[#1F3A5F]/40 hover:bg-slate-50 hover:text-[#1F3A5F] disabled:opacity-50"
      >
        <Icon name="print" className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[10px] font-bold text-[#FF2147]">{error}</span>}
    </div>
  )
}

export default function StaffInvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('all')

  useEffect(() => {
    api.get('/invoices')
      .then((res) => setInvoices(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load invoices.'))
      .finally(() => setLoading(false))
  }, [])

  const query = search.trim().toLowerCase()

  const visible = useMemo(() => {
    const cutoff = range === 'all' ? null : Date.now() - Number(range) * 86400000
    return invoices
      .filter((inv) => {
        if (status !== 'all' && inv.status !== status) return false
        if (cutoff && new Date(inv.issued_at).getTime() < cutoff) return false
        if (!query) return true
        return `${inv.invoice_number} ${inv.booking_reference || ''} ${inv.room_number || ''}`.toLowerCase().includes(query)
      })
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))
  }, [invoices, query, status, range])

  // Summaries reflect the CURRENT filter, so narrowing to "unpaid, last 30
  // days" answers "how much is outstanding this month?" directly.
  const totals = useMemo(() => {
    const billed = visible.reduce((sum, i) => sum + Number(i.total_amount || 0), 0)
    const paid = visible.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0)
    return { billed, paid, outstanding: billed - paid }
  }, [visible])

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1F3A5F]">Hotel Invoices</h1>
        <p className="mt-1 text-slate-500">Guest billing across all bookings</p>
      </div>

      {!loading && invoices.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Total billed</p>
            <p className="mt-1 font-serif text-2xl text-[#1F3A5F]">{money(totals.billed)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Collected</p>
            <p className="mt-1 font-serif text-2xl text-emerald-600">{money(totals.paid)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Outstanding</p>
            <p className={`mt-1 font-serif text-2xl ${totals.outstanding > 0 ? 'text-[#FF2147]' : 'text-[#1F3A5F]'}`}>
              {money(totals.outstanding)}
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, booking or room…"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1F3A5F]"
          />
        </div>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(s.value)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              status === s.value ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {s.label}
          </button>
        ))}
        <select value={range} onChange={(e) => setRange(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#1F3A5F]">
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}
      {!loading && invoices.length === 0 && <p className="text-slate-500">No invoices yet.</p>}
      {!loading && invoices.length > 0 && visible.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-slate-200/80">
          <p className="text-sm text-slate-500">Nothing matches those filters.</p>
          <button type="button" onClick={() => { setSearch(''); setStatus('all'); setRange('all') }} className="mt-3 text-sm font-bold text-[#1F3A5F] underline">
            Clear filters
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <>
          <p className="mb-3 text-xs text-slate-400">Showing {visible.length} of {invoices.length} invoices</p>

          <div className="space-y-3 sm:hidden">
            {visible.map((inv) => (
              <div key={inv.id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/80">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold text-[#1F3A5F]">{inv.invoice_number}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                    {inv.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-600">Room {inv.room_number || '—'} · {inv.booking_reference || '—'}</p>
                <p className="mt-0.5 text-xs text-slate-400">{formatDate(inv.issued_at)}</p>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="font-serif text-xl text-[#1F3A5F]">{money(inv.total_amount)}</span>
                  <RowActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.1em] text-slate-400">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold">Invoice</th>
                    <th className="px-5 py-3 text-left font-bold">Booking</th>
                    <th className="px-5 py-3 text-left font-bold">Room</th>
                    <th className="px-5 py-3 text-left font-bold">Issued</th>
                    <th className="px-5 py-3 text-right font-bold">Total</th>
                    <th className="px-5 py-3 text-left font-bold">Status</th>
                    <th className="px-5 py-3 text-right font-bold">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((inv) => (
                    <tr key={inv.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4 font-semibold text-[#1F3A5F]">{inv.invoice_number}</td>
                      <td className="px-5 py-4 text-slate-600">{inv.booking_reference || '—'}</td>
                      <td className="px-5 py-4 text-slate-600">{inv.room_number || '—'}</td>
                      <td className="px-5 py-4 text-slate-500">{formatDate(inv.issued_at)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-[#1F3A5F]">{money(inv.total_amount)}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[inv.status] || 'bg-slate-100 text-slate-600'}`}>
                          {inv.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <RowActions invoiceId={inv.id} invoiceNumber={inv.invoice_number} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  )
}