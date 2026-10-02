import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { requireAuth } from '../../lib/authRedirect'

// Service windows, so a guest picks from realistic times rather than typing
// one and being told the kitchen is closed.
const LUNCH = ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30']
const DINNER = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30']

const SCENES = [
  { url: '/images/restaurant/dining-room-chandelier.jpg', caption: 'The main dining room' },
  { url: '/images/restaurant/dining-room-long-table.jpg', caption: 'The long table, for larger parties' },
  { url: '/images/restaurant/terrace-sunset.jpg', caption: 'The terrace at golden hour' },
  { url: '/images/restaurant/restaurant-hall.avif', caption: 'The hall' },
]

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    check: (<path d="M20 6 9 17l-5-5" />),
    sparkle: (<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />),
    clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
    calendar: (<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
    users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

// An overhead place setting — the way a restaurant floor plan is actually
// drawn: the table top, a cover per seat with plate and cutlery, and chairs
// around it. Reads as a laid table rather than a diagram.
function TableIcon({ seats = 2, className = 'h-11 w-11', tone = 'currentColor' }) {
  const covers = Math.min(Math.max(seats, 1), 8)
  const isRound = covers <= 4

  if (isRound) {
    const places = Array.from({ length: covers }, (_, i) => {
      const angle = (i / covers) * Math.PI * 2 - Math.PI / 2
      return {
        x: 18 + Math.cos(angle) * 11,
        y: 18 + Math.sin(angle) * 11,
        rotate: (angle * 180) / Math.PI + 90,
      }
    })
    return (
      <svg className={className} viewBox="0 0 36 36" fill="none" stroke={tone} strokeWidth="1.3">
        <circle cx="18" cy="18" r="8.5" fill={tone} fillOpacity="0.07" />
        <circle cx="18" cy="18" r="8.5" />
        {places.map((p, i) => (
          <g key={i} transform={`rotate(${p.rotate} ${p.x} ${p.y})`}>
            <circle cx={p.x} cy={p.y} r="2.6" strokeWidth="1.2" />
            <path d={`M${p.x - 4.3} ${p.y - 1.6} v3.2`} strokeWidth="1.1" strokeLinecap="round" />
            <path d={`M${p.x + 4.3} ${p.y - 1.6} v3.2`} strokeWidth="1.1" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    )
  }

  // Larger parties sit at a long table, so it is drawn as one.
  const perSide = Math.ceil(covers / 2)
  const spacing = 22 / Math.max(perSide, 1)
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" stroke={tone} strokeWidth="1.3">
      <rect x="9" y="7" width="18" height="22" rx="2.5" fill={tone} fillOpacity="0.07" />
      <rect x="9" y="7" width="18" height="22" rx="2.5" />
      {Array.from({ length: perSide }, (_, i) => {
        const y = 7 + spacing / 2 + i * spacing
        return (
          <g key={i}>
            <circle cx="13.5" cy={y} r="2.2" strokeWidth="1.1" />
            <circle cx="22.5" cy={y} r="2.2" strokeWidth="1.1" />
            <path d={`M5.5 ${y - 1.8} v3.6`} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
            <path d={`M30.5 ${y - 1.8} v3.6`} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
          </g>
        )
      })}
    </svg>
  )
}

function prettyWhen(date, time) {
  try {
    return new Date(`${date}T${time}:00`).toLocaleString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return `${date} at ${time}`
  }
}

// Table size tells a guest what the table is FOR — intimate, family, or a
// gathering — which is more useful than a bare seat count.
function tableCharacter(capacity) {
  if (capacity <= 2) return { label: 'Intimate', tint: 'bg-rose-50 text-rose-700' }
  if (capacity <= 4) return { label: 'Classic', tint: 'bg-blue-50 text-blue-700' }
  if (capacity <= 6) return { label: 'Family', tint: 'bg-amber-50 text-amber-700' }
  return { label: 'Private party', tint: 'bg-violet-50 text-violet-700' }
}

function SceneStrip({ restaurantName }) {
  const [failed, setFailed] = useState(() => new Set())
  const [index, setIndex] = useState(0)
  const scenes = useMemo(() => SCENES.filter((s) => !failed.has(s.url)), [failed])

  useEffect(() => {
    if (scenes.length <= 1) return undefined
    // Slow and unhurried: atmosphere, not a slideshow competing with a form.
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % scenes.length), 5500)
    return () => window.clearInterval(timer)
  }, [scenes.length])

  useEffect(() => {
    if (index >= scenes.length) setIndex(0)
  }, [scenes.length, index])

  if (!scenes.length) return null

  return (
    <div className="relative h-[280px] overflow-hidden bg-[#0E2036] sm:h-[340px]">
      <style>{`@keyframes tableDrift { from { transform: scale(1.05); } to { transform: scale(1.13); } }`}</style>
      {scenes.map((scene, i) => (
        <img
          key={scene.url}
          src={scene.url}
          alt=""
          onError={() => setFailed((prev) => new Set(prev).add(scene.url))}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms]"
          style={{ opacity: i === index ? 1 : 0, animation: i === index ? 'tableDrift 7000ms linear forwards' : 'none' }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0E2036] via-[#0E2036]/45 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 px-7 pb-7 sm:px-12 sm:pb-9">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#FF2147]">Reserve</p>
            <h3 className="mt-2.5 font-serif text-4xl leading-tight text-white sm:text-5xl">Book a table</h3>
            <p className="mt-2.5 max-w-lg text-[15px] leading-7 text-white/65">
              {restaurantName ? `${restaurantName} — we check the floor plan live, so every table we show you is genuinely free.` : 'We check the floor plan live, so every table we show you is genuinely free.'}
            </p>
          </div>
          <div className="flex gap-1.5 pb-1">
            {scenes.map((scene, i) => (
              <button
                key={scene.url}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show ${scene.caption}`}
                className={`h-1 rounded-full transition-all duration-500 ${i === index ? 'w-10 bg-[#FF2147]' : 'w-4 bg-white/30 hover:bg-white/60'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReserveTablePanel({ restaurantId, restaurantName, onAskAlice }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('19:00')
  const [partySize, setPartySize] = useState(2)
  const [notes, setNotes] = useState('')

  const [tables, setTables] = useState(null)
  const [tableId, setTableId] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  // Any change to the criteria invalidates the previous result — showing
  // tables found for 7pm while the guest has since picked 9pm would mislead.
  useEffect(() => {
    setTables(null)
    setTableId('')
    setError('')
  }, [date, time, partySize, restaurantId])

  async function findTables(event) {
    event?.preventDefault()
    if (!restaurantId) return
    setError('')
    setSearching(true)
    try {
      const res = await api.get(`/restaurants/${restaurantId}/tables/available`, {
        params: { reservation_start: `${date}T${time}:00`, party_size: partySize },
      })
      const found = Array.isArray(res.data) ? res.data : []
      // Smallest suitable table first: seating two people at a fifteen-seater
      // wastes the room and rarely suits the guest either.
      found.sort((a, b) => a.capacity - b.capacity)
      setTables(found)
      if (found.length === 1) setTableId(found[0].id)
    } catch (err) {
      setError(err.response?.data?.detail || 'We could not check availability just now. Please try again.')
      setTables([])
    } finally {
      setSearching(false)
    }
  }

  async function confirm() {
    if (!tableId) {
      setError('Choose a table first.')
      return
    }
    // Browsing and checking availability stay open to everyone; only the
    // commitment needs an account, and signing in returns here.
    if (!requireAuth(user, navigate, location, {
      reason: 'Please sign in to confirm your table. It only takes a moment.',
    })) return

    setError('')
    setSubmitting(true)
    try {
      const res = await api.post('/reservations', {
        table_id: tableId,
        reservation_start: `${date}T${time}:00`,
        party_size: partySize,
        notes: notes.trim() || null,
      })
      setConfirmation(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'We could not confirm that reservation. Please try another time.')
    } finally {
      setSubmitting(false)
    }
  }

  const selected = useMemo(() => (tables || []).find((t) => t.id === tableId) || null, [tables, tableId])
  const field = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-[15px] text-[#1F3A5F] outline-none transition focus:border-[#1F3A5F] focus:ring-2 focus:ring-[#1F3A5F]/10'

  if (confirmation) {
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-38px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70">
        <SceneStrip restaurantName={restaurantName} />
        <div className="flex flex-col items-center px-8 py-16 text-center sm:px-12">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Icon name="check" className="h-8 w-8" />
          </span>
          <h3 className="mt-7 font-serif text-4xl text-[#1F3A5F]">Your table is booked.</h3>
          <p className="mt-4 text-[16px] leading-8 text-slate-600">
            Table {confirmation.table_number} for {confirmation.party_size} {confirmation.party_size === 1 ? 'guest' : 'guests'}
            <br />
            {prettyWhen(date, time)}
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-400">
            A confirmation is on its way to your inbox. Do let us know if your plans change.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => navigate('/my-account?tab=reservations')} className="rounded-xl bg-[#1F3A5F] px-7 py-3.5 text-sm font-bold text-white transition hover:bg-[#162f4d]">
              My reservations
            </button>
            <button
              type="button"
              onClick={() => { setConfirmation(null); setTables(null); setTableId(''); setNotes('') }}
              className="rounded-xl border border-slate-300 px-7 py-3.5 text-sm font-bold text-[#1F3A5F] transition hover:bg-slate-50"
            >
              Book another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-38px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70">
      <SceneStrip restaurantName={restaurantName} />

      <div className="bg-white px-7 py-10 sm:px-12 sm:py-12">
        <form onSubmit={findTables}>
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" /> Date
              </span>
              <div className="mt-2"><input type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} className={field} /></div>
            </label>

            <label className="block">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                <Icon name="users" className="h-3.5 w-3.5 text-slate-400" /> Guests
              </span>
              <div className="mt-2">
                <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} className={field}>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'guest' : 'guests'}</option>)}
                </select>
              </div>
            </label>

            <button
              type="submit"
              disabled={searching}
              className="h-[54px] rounded-xl bg-[#FF2147] px-10 text-sm font-bold uppercase tracking-[0.08em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#dc1539] disabled:translate-y-0 disabled:opacity-50"
            >
              {searching ? 'Checking…' : 'Find a table'}
            </button>
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Time</span>
              <span className="h-px flex-1 bg-slate-200" />
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1F3A5F]">
                <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" /> {time}
              </span>
            </div>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {[{ label: 'Lunch', slots: LUNCH }, { label: 'Dinner', slots: DINNER }].map((service) => (
                <div key={service.label}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{service.label}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {service.slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                          time === slot
                            ? 'bg-[#1F3A5F] text-white shadow-sm'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:-translate-y-0.5 hover:text-[#1F3A5F] hover:ring-[#1F3A5F]/40'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {tables !== null && (
          <div className="mt-10 border-t border-slate-200 pt-9">
            {tables.length === 0 ? (
              <div className="py-6 text-center">
                <p className="font-serif text-2xl text-[#1F3A5F]">Nothing free at {time}.</p>
                <p className="mx-auto mt-2.5 max-w-md text-[15px] leading-7 text-slate-500">
                  Try half an hour either side, or a smaller party — we fill quickly at peak times.
                </p>
                {onAskAlice && (
                  <button type="button" onClick={onAskAlice} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1F3A5F] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#162f4d]">
                    <Icon name="sparkle" className="h-4 w-4" />
                    Ask Alice to find an alternative
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-9 lg:grid-cols-[1.5fr_1fr] lg:items-start">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    {tables.length} table{tables.length === 1 ? '' : 's'} free · {prettyWhen(date, time)}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {tables.map((table) => {
                      const character = tableCharacter(table.capacity)
                      const chosen = tableId === table.id
                      return (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => setTableId(table.id)}
                          className={`group rounded-2xl px-4 py-4 text-left transition duration-200 ${
                            chosen
                              ? 'bg-[#1F3A5F] text-white shadow-xl ring-2 ring-[#1F3A5F]'
                              : 'bg-white text-[#1F3A5F] shadow-sm ring-1 ring-black/5 hover:-translate-y-1 hover:shadow-xl hover:ring-[#FF2147]/60'
                          }`}
                        >
                          <span className={`inline-block transition-transform duration-300 group-hover:scale-105 ${chosen ? 'text-white' : 'text-[#1F3A5F]/75 group-hover:text-[#FF2147]'}`}>
                            <TableIcon seats={table.capacity} tone="currentColor" />
                          </span>
                          <p className="mt-2.5 text-sm font-bold">Table {table.table_number}</p>
                          <p className={`text-xs ${chosen ? 'text-white/60' : 'text-slate-500'}`}>
                            Seats {table.capacity}
                          </p>
                          <span className={`mt-2.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${chosen ? 'bg-white/15 text-white/80' : character.tint}`}>
                            {character.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Navy panel with a red edge and label: a fully red panel
                    would swallow the red Confirm button inside it, which is
                    the one element that must stand out. */}
                <aside className="overflow-hidden rounded-2xl bg-[#1F3A5F] text-white shadow-xl lg:sticky lg:top-24">
                  <div className="h-1.5 bg-[#FF2147]" />
                  <div className="p-7">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FF2147]">Your reservation</p>

                  {selected ? (
                    <>
                      <p className="mt-4 font-serif text-3xl leading-tight">Table {selected.table_number}</p>
                      <div className="mt-5 space-y-2.5 border-t border-white/15 pt-5 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-white/55">When</span>
                          <span className="text-right">{prettyWhen(date, time)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-white/55">Party</span>
                          <span>{partySize} {partySize === 1 ? 'guest' : 'guests'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-white/55">Seats</span>
                          <span>Up to {selected.capacity}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-[15px] leading-7 text-white/60">
                      Choose a table to the left and your reservation will appear here.
                    </p>
                  )}

                  <label className="mt-6 block">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">Anything we should know?</span>
                    <div className="mt-2">
                      <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={500}
                        placeholder="A birthday, a quiet corner, an allergy…"
                        className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-[14px] text-white placeholder-white/35 outline-none transition focus:border-white/40"
                      />
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={confirm}
                    disabled={submitting || !tableId}
                    className="mt-6 w-full rounded-xl bg-[#FF2147] py-4 text-sm font-bold uppercase tracking-[0.06em] text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                  >
                    {submitting ? 'Confirming…' : 'Confirm reservation'}
                  </button>

                  <p className="mt-4 text-center text-xs leading-5 text-white/40">
                    {user ? 'No card needed — we hold the table for 15 minutes past your time.' : "You'll sign in to confirm; your choice is saved."}
                  </p>
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}