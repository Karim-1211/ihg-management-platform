import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import AppLayout from '../../components/layout/AppLayout'

const STATUS_STYLE = {
  PENDING: 'bg-amber-50 text-amber-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  DONE: 'bg-emerald-50 text-emerald-700',
}

function waitingMinutes(value) {
  if (!value) return 0
  return Math.floor((Date.now() - new Date(value).getTime()) / 60000)
}

function waitLabel(mins) {
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  return `${Math.floor(hours / 24)}d`
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>),
    clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function TaskCard({ task, onUpdate, busy }) {
  const mins = waitingMinutes(task.created_at)
  const open = task.status !== 'DONE'
  // Anything over a day is old test data, shown quietly in grey. Red is kept
  // for a room that is genuinely holding up today's arrivals — a board where
  // every card is red tells the team nothing.
  const stale = open && mins >= 1440
  const urgent = open && !stale && mins >= 240
  const warn = open && !stale && mins >= 120 && mins < 240
  const accent = task.status === 'DONE' ? '#10B981'
    : stale ? '#CBD5E1'
    : urgent ? '#FF2147'
    : warn ? '#F59E0B'
    : '#1F3A5F'

  return (
    <article className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/80 transition hover:shadow-md">
      <div className="h-1" style={{ background: accent }} />

      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-lg font-bold text-[#1F3A5F]">Room {task.room_number || '?'}</span>
        {open && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${urgent ? 'text-[#FF2147]' : warn ? 'text-amber-600' : 'text-slate-400'}`}>
            <Icon name="clock" className="h-3.5 w-3.5" />
            {waitLabel(mins)}
          </span>
        )}
      </div>

      <div className="p-5 pt-3">
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${STATUS_STYLE[task.status]}`}>
          {task.status.replace('_', ' ')}
        </span>

        {task.notes && <p className="mt-3 text-sm leading-6 text-slate-600">{task.notes}</p>}

        {task.completed_at && (
          <p className="mt-2 text-xs text-slate-400">
            Finished {new Date(task.completed_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          {task.status === 'PENDING' && (
            <button onClick={() => onUpdate(task.id, 'IN_PROGRESS')} disabled={busy} className="w-full rounded-xl bg-[#1F3A5F] py-2.5 text-sm font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">
              Start cleaning
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <button onClick={() => onUpdate(task.id, 'DONE')} disabled={busy} className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              Mark room ready
            </button>
          )}
          {task.status === 'DONE' && (
            <p className="text-center text-sm font-semibold text-emerald-600">Room is ready to sell</p>
          )}
        </div>
      </div>
    </article>
  )
}

export default function HousekeepingPage() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [search, setSearch] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [, forceTick] = useState(0)

  function loadTasks() {
    api.get('/housekeeping/tasks')
      .then((res) => setTasks(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError('Could not load tasks.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTasks()
    const poll = window.setInterval(loadTasks, 30000)
    // Redraw periodically so the waiting times stay accurate between polls.
    const tick = window.setInterval(() => forceTick((n) => n + 1), 60000)
    return () => { window.clearInterval(poll); window.clearInterval(tick) }
  }, [])

  async function handleUpdateStatus(taskId, status) {
    setError('')
    setUpdatingId(taskId)
    try {
      await api.patch(`/housekeeping/tasks/${taskId}`, { status })
      loadTasks()
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not update that task.')
    } finally {
      setUpdatingId(null)
    }
  }

  const query = search.trim().toLowerCase()

  const matching = useMemo(
    () => tasks.filter((t) => {
      if (!query) return true
      return `${t.room_number || ''} ${t.notes || ''}`.toLowerCase().includes(query)
    }),
    [tasks, query]
  )

  // Oldest pending first: the room out of service longest is the one to
  // clean next, so it can be sold again soonest.
  const groups = useMemo(() => {
    const oldestFirst = (a, b) => new Date(a.created_at) - new Date(b.created_at)
    const newestFirst = (a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at)

    return [
      { key: 'pending', title: 'Waiting', hint: 'Longest waiting first', accent: '#FF2147', items: matching.filter((t) => t.status === 'PENDING').sort(oldestFirst) },
      { key: 'progress', title: 'Being cleaned', hint: 'In progress', accent: '#3B82F6', items: matching.filter((t) => t.status === 'IN_PROGRESS').sort(oldestFirst) },
      { key: 'done', title: 'Ready', hint: 'Recently finished', accent: '#10B981', items: matching.filter((t) => t.status === 'DONE').sort(newestFirst) },
    ]
  }, [matching])

  const visibleGroups = showDone ? groups : groups.filter((g) => g.key !== 'done')
  const waiting = groups[0].items.length

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">Housekeeping</h1>
          <p className="mt-1 text-slate-500">Rooms awaiting cleaning after checkout</p>
        </div>
        {waiting > 0 && (
          <span className="rounded-full bg-[#FF2147]/10 px-4 py-2 text-sm font-bold text-[#FF2147]">
            {waiting} room{waiting === 1 ? '' : 's'} waiting
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" /></span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search room number or note…"
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#1F3A5F]"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${showDone ? 'bg-[#1F3A5F] text-white' : 'bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50'}`}
        >
          {showDone ? 'Hide finished' : 'Show finished'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading && <p className="text-slate-500">Loading…</p>}

      {!loading && tasks.length === 0 && (
        <div className="rounded-2xl bg-white px-6 py-20 text-center ring-1 ring-slate-200/80">
          <p className="font-serif text-2xl text-[#1F3A5F]">Every room is ready.</p>
          <p className="mt-2 text-sm text-slate-500">No housekeeping tasks are outstanding.</p>
        </div>
      )}

      <div className="space-y-9">
        {tasks.length > 0 && visibleGroups.map((group) => (
          <section key={group.key}>
            <div className="mb-4 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.accent }} />
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[#1F3A5F]">{group.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">{group.items.length}</span>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">{group.hint}</span>
            </div>

            {group.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-400">Nothing here.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {group.items.map((task) => (
                  <TaskCard key={task.id} task={task} busy={updatingId === task.id} onUpdate={handleUpdateStatus} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </AppLayout>
  )
}