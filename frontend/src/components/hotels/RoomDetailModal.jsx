import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../services/api'

// Amenities arrive as a flat list, but a guest reads them in groups — what's
// in the bathroom, what's for working, what's included. Grouping by keyword
// means the room page reads like a hotel's own, without needing new fields.
const GROUPS = [
  { key: 'comfort', title: 'Comfort & sleep', match: ['bed', 'pillow', 'turndown', 'curtain', 'blackout', 'air condition', 'lounge', 'seat', 'armchair', 'balcony', 'window'] },
  { key: 'bathroom', title: 'Bathroom', match: ['bath', 'shower', 'tub', 'robe', 'slipper', 'toiletries', 'hairdryer'] },
  { key: 'food', title: 'Food & drink', match: ['coffee', 'tea', 'nespresso', 'minibar', 'kettle'] },
  { key: 'work', title: 'Work & entertainment', match: ['wi-fi', 'wifi', 'desk', 'television', 'tv', 'telephone', 'safe'] },
  { key: 'service', title: 'Service', match: ['housekeeping', 'service', 'iron', 'wardrobe', 'laundry'] },
]

function groupAmenities(amenities = []) {
  const remaining = [...amenities]
  const grouped = []
  for (const group of GROUPS) {
    const matched = remaining.filter((a) => group.match.some((m) => a.toLowerCase().includes(m)))
    if (matched.length) {
      grouped.push({ title: group.title, items: matched })
      matched.forEach((m) => remaining.splice(remaining.indexOf(m), 1))
    }
  }
  if (remaining.length) grouped.push({ title: 'Also included', items: remaining })
  return grouped
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    close: (<path d="M6 18 18 6M6 6l12 12" />),
    left: (<path d="m15 19-7-7 7-7" />),
    right: (<path d="m9 5 7 7-7 7" />),
    check: (<path d="M20 6 9 17l-5-5" />),
    bed: (<><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M2 16h20M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>),
    users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>),
    view: (<><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /></>),
    balcony: (<><path d="M4 21V10h16v11M4 14h16M9 10V5h6v5M12 14v7" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function SpecTile({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="rounded-xl bg-[#F5F2ED] px-4 py-3.5">
      <span className="flex items-center gap-2 text-slate-400"><Icon name={icon} className="h-3.5 w-3.5" /></span>
      <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold leading-5 text-[#1F3A5F]">{value}</p>
    </div>
  )
}

export default function RoomDetailModal({ roomType, room, availableCount, nights, onClose, onBook }) {
  const [images, setImages] = useState([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!roomType) return undefined
    let cancelled = false
    // A specific room's own photographs are preferred; the room type's set
    // is the fallback, so every room shows something real.
    const entity = room ? { entity_type: 'ROOM', entity_id: room.id } : { entity_type: 'ROOM_TYPE', entity_id: roomType.id }
    api.get('/media', { params: entity })
      .then((res) => {
        if (cancelled) return
        const found = res.data || []
        if (found.length || !room) { setImages(found); return }
        return api.get('/media', { params: { entity_type: 'ROOM_TYPE', entity_id: roomType.id } })
          .then((fallback) => { if (!cancelled) setImages(fallback.data || []) })
      })
      .catch(() => { if (!cancelled) setImages([]) })
    return () => { cancelled = true }
  }, [roomType, room])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const count = images.length
  const step = useCallback((delta) => {
    if (count === 0) return
    setActive((i) => ((i + delta) % count + count) % count)
  }, [count])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  const grouped = useMemo(() => {
    const all = [...(roomType?.amenities || [])]
    if (roomType?.has_balcony && !all.some((a) => a.toLowerCase().includes('balcony'))) all.push('Private balcony')
    if (roomType?.has_bathtub && !all.some((a) => a.toLowerCase().includes('tub'))) all.push('Soaking bathtub')
    return groupAmenities(all)
  }, [roomType])

  if (!roomType) return null

  const hasAvailability = (availableCount ?? 0) > 0
  const mainImage = images[active]?.url || roomType.primary_image_url
  const rate = Number(roomType.base_price || 0)
  const stayTotal = nights > 0 ? rate * nights : null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-slate-900/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={roomType.name}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="min-h-full w-full max-w-6xl bg-white shadow-2xl sm:min-h-0 sm:max-h-[94vh] sm:overflow-y-auto sm:rounded-2xl">

        <div className="relative bg-slate-900">
          {mainImage ? (
            <img src={mainImage} alt={images[active]?.alt_text || roomType.name} className="h-[42vh] w-full object-cover sm:h-[52vh]" />
          ) : (
            <div className="flex h-[36vh] items-center justify-center text-sm text-white/40">No photographs yet</div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-black/40 p-2.5 text-white backdrop-blur-sm transition hover:bg-black/70"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>

          {count > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2.5 text-white transition hover:bg-black/60">
                <Icon name="left" className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2.5 text-white transition hover:bg-black/60">
                <Icon name="right" className="h-5 w-5" />
              </button>
              <span className="absolute bottom-5 right-5 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                {active + 1} / {count}
              </span>
            </>
          )}

          <div className="absolute bottom-5 left-6 right-24">
            {room && <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Room {room.room_number}</p>}
            <h2 className="mt-1 font-serif text-3xl leading-tight text-white sm:text-5xl">{roomType.name}</h2>
          </div>
        </div>

        {count > 1 && (
          <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-6 py-4">
            {images.map((img, i) => (
              <button
                key={img.id || img.url}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === active ? 'ring-[#FF2147]' : 'opacity-60 ring-transparent hover:opacity-100'}`}
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            {roomType.description && (
              <p className="text-[16px] leading-8 text-slate-600">{roomType.description}</p>
            )}

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SpecTile icon="users" label="Sleeps" value={roomType.max_occupancy ? `Up to ${roomType.max_occupancy}` : null} />
              <SpecTile icon="bed" label="Bed" value={roomType.bed_configuration} />
              <SpecTile icon="view" label="Outlook" value={roomType.view_type} />
              <SpecTile icon="balcony" label="Balcony" value={roomType.has_balcony ? 'Private balcony' : 'No balcony'} />
            </div>

            {grouped.length > 0 && (
              <div className="mt-10">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF2147]">What's included</p>
                <h3 className="mt-2 font-serif text-2xl text-[#1F3A5F]">Everything in this room</h3>

                <div className="mt-6 grid gap-8 sm:grid-cols-2">
                  {grouped.map((group) => (
                    <div key={group.title}>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{group.title}</p>
                      <ul className="mt-3 space-y-2">
                        {group.items.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-6 text-slate-600">
                            <span className="mt-1 shrink-0 text-[#FF2147]"><Icon name="check" className="h-3.5 w-3.5" /></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-10 rounded-2xl border border-slate-200 p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Good to know</p>
              <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-600 sm:grid-cols-2">
                <p><span className="font-semibold text-[#1F3A5F]">Check-in</span> from 2:00 PM</p>
                <p><span className="font-semibold text-[#1F3A5F]">Check-out</span> by 12:00 noon</p>
                <p><span className="font-semibold text-[#1F3A5F]">Housekeeping</span> daily, with evening turndown on request</p>
                <p><span className="font-semibold text-[#1F3A5F]">Room service</span> available throughout your stay</p>
              </div>
            </div>
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl bg-[#1F3A5F] p-7 text-white shadow-xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/50">Rate</p>
              <p className="mt-2 font-serif text-4xl">
                ${rate.toFixed(2)}
                <span className="ml-2 text-base font-normal text-white/60">per night</span>
              </p>

              {stayTotal != null && (
                <div className="mt-5 space-y-2 border-t border-white/15 pt-4 text-sm">
                  <div className="flex justify-between text-white/65">
                    <span>{nights} night{nights === 1 ? '' : 's'}</span>
                    <span>${stayTotal.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-white/45">Tax is calculated at checkout.</p>
                </div>
              )}

              {availableCount != null && (
                <p className={`mt-5 text-sm font-semibold ${hasAvailability ? 'text-emerald-300' : 'text-white/60'}`}>
                  {hasAvailability
                    ? `${availableCount} available for your dates`
                    : 'Not available for the dates you chose'}
                </p>
              )}

              <button
                type="button"
                onClick={onBook}
                className="mt-6 w-full rounded-xl bg-[#FF2147] py-4 text-sm font-bold uppercase tracking-[0.06em] text-white transition hover:bg-[#dc1539]"
              >
                {hasAvailability ? 'Book this room' : 'Check availability'}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-white/45">
                Free cancellation up to the policy cut-off. No payment is taken until checkout.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}