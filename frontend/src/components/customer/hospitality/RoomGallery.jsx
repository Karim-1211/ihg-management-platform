import { useEffect, useMemo, useState } from 'react'
import api from '../../../services/api'
import { splitHotelDescription } from '../../../lib/hotelFacilities'

// Amenities arrive as a flat list, but a guest reads them in groups — what's
// in the bathroom, what's for working, what's included with the room.
const GROUPS = [
  { title: 'Comfort & sleep', match: ['bed', 'pillow', 'turndown', 'curtain', 'blackout', 'air condition', 'lounge', 'seat', 'armchair', 'balcony', 'window', 'linen'] },
  { title: 'Bathroom', match: ['bath', 'shower', 'tub', 'robe', 'slipper', 'toiletries', 'hairdryer', 'amenities'] },
  { title: 'Food & drink', match: ['coffee', 'tea', 'nespresso', 'minibar', 'kettle', 'water', 'fruit', 'room service'] },
  { title: 'Work & entertainment', match: ['wi-fi', 'wifi', 'desk', 'television', 'tv', 'telephone', 'safe', 'newspaper'] },
  { title: 'Service', match: ['housekeeping', 'iron', 'wardrobe', 'laundry', 'luggage'] },
]

// One line per room type, written to give a guest a reason to want the room
// rather than simply naming it again.
const ROOM_HEADLINES = {
  'Deluxe Suite': 'The corner suite, with the city at your window.',
  'Standard Room': 'Everything you need, and nothing you won\'t use.',
  'Lake View Room': 'Wake to the water, on the quiet side of the building.',
  'Sea View Room': 'A room built around the view, and a balcony worth sitting on.',
  'Mountain View Room': 'High, quiet, and facing the ridgeline.',
  _default: 'A quiet room, considered down to the details.',
}

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
    check: (<path d="M20 6 9 17l-5-5" />),
    bed: (<><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8M2 16h20M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>),
    users: (<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>),
    view: (<><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /></>),
    balcony: (<><path d="M4 21V10h16v11M4 14h16M9 10V5h6v5M12 14v7" /></>),
    expand: (<><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></>),
    pool: (<><path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5S16 18 18 18s2-1.5 4-1.5M6 14V5a2 2 0 0 1 4 0M14 14V5a2 2 0 0 1 4 0M6 8h4M14 8h4" /></>),
    spa: (<><path d="M12 22c0-6 4-10 9-10-1 6-4 10-9 10Zm0 0c0-6-4-10-9-10 1 6 4 10 9 10Z" /><path d="M12 22V9a4 4 0 0 1 4-4" /></>),
    gym: (<><path d="M4 8v8M8 6v12M16 6v12M20 8v8M8 12h8" /></>),
    dining: (<><path d="M4 3v18M4 8h4M4 13h4M17 3v18M14 8h6M17 3a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3" /></>),
    bar: (<><path d="m4 5 8 8 8-8ZM12 13v7M8 20h8" /></>),
    car: (<><path d="M5 17h14M6 17v2M18 17v2M4 13l1.5-5A2 2 0 0 1 7.4 7h9.2a2 2 0 0 1 1.9 1L20 13M4 13h16v4H4Z" /><circle cx="7.5" cy="15" r=".6" /><circle cx="16.5" cy="15" r=".6" /></>),
    work: (<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></>),
    wifi: (<><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" /></>),
    service: (<><path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 7v4M12 5h.01" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

function Spec({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="rounded-xl bg-[#F5F2ED] px-3.5 py-3">
      <span className="text-slate-400"><Icon name={icon} className="h-3.5 w-3.5" /></span>
      <p className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold leading-5 text-[#1F3A5F]">{value}</p>
    </div>
  )
}

export default function RoomGallery({
  images = [],
  roomName = 'Room',
  room = null,
  roomType = null,
  hotel = null,
  nights = 0,
  availableCount = null,
  onBook = null,
  onClose,
}) {
  const safeImages = useMemo(
    () => [...new Map(images.filter((item) => item?.url).map((item) => [item.url, item])).values()],
    [images]
  )
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [resolvedHotel, setResolvedHotel] = useState(hotel)

  // The hotel's facilities are part of what a guest is buying, so the room
  // page fetches them if the caller didn't pass them in.
  useEffect(() => {
    if (hotel || !room?.hotel_id) return undefined
    let cancelled = false
    api.get('/hotels')
      .then((res) => {
        if (cancelled) return
        setResolvedHotel((res.data || []).find((h) => h.id === room.hotel_id) || null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [hotel, room])

  useEffect(() => { setIndex(0) }, [safeImages.map((i) => i.url).join('|')])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        if (lightbox) setLightbox(false)
        else onClose()
      }
      if (!safeImages.length) return
      if (event.key === 'ArrowRight') setIndex((v) => (v + 1) % safeImages.length)
      if (event.key === 'ArrowLeft') setIndex((v) => (v - 1 + safeImages.length) % safeImages.length)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox, onClose, safeImages.length])

  const grouped = useMemo(() => {
    const all = [...(roomType?.amenities || [])]
    if (roomType?.has_balcony && !all.some((a) => a.toLowerCase().includes('balcony'))) all.push('Private balcony')
    if (roomType?.has_bathtub && !all.some((a) => a.toLowerCase().includes('tub'))) all.push('Soaking bathtub')
    return groupAmenities(all)
  }, [roomType])

  const { facilities } = useMemo(
    () => splitHotelDescription(resolvedHotel?.description),
    [resolvedHotel]
  )

  const current = safeImages[index]
  const rate = Number(roomType?.base_price || 0)
  const stayTotal = nights > 0 ? rate * nights : null
  const hasAvailability = availableCount == null || availableCount > 0

  function move(delta) {
    if (!safeImages.length) return
    setIndex((v) => (v + delta + safeImages.length) % safeImages.length)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90] flex items-stretch justify-center bg-black/80 p-0 sm:items-center sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label={`${roomName} details`}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="flex h-full w-full max-w-7xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-2xl">

          {/* Fixed header: previously this scrolled away on a short window and
              took the close button with it. */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF2147]">
                {roomType?.name || 'Room details'}
              </p>
              <h2 className="mt-1 truncate font-serif text-2xl text-[#1F3A5F]">{roomName}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-[#1F3A5F]"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[1.3fr_1fr]">

            <div className="flex min-h-0 flex-col bg-slate-950">
              <div className="relative min-h-[240px] flex-1">
                {current ? (
                  <img src={current.url} alt={current.alt_text || roomName} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-white/40">
                    No photographs available yet
                  </div>
                )}

                {safeImages.length > 1 && (
                  <>
                    <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white transition hover:bg-black/75">‹</button>
                    <button type="button" onClick={() => move(1)} aria-label="Next image" className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white transition hover:bg-black/75">›</button>
                    <span className="absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      {index + 1} / {safeImages.length}
                    </span>
                  </>
                )}

                {current && (
                  <button type="button" onClick={() => setLightbox(true)} className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-xs font-bold text-[#1F3A5F] shadow-lg transition hover:bg-white">
                    <Icon name="expand" className="h-3.5 w-3.5" />
                    Full screen
                  </button>
                )}
              </div>

              {safeImages.length > 1 && (
                <div className="flex shrink-0 gap-2 overflow-x-auto bg-slate-900 px-4 py-3">
                  {safeImages.map((image, i) => (
                    <button
                      key={image.url}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Show image ${i + 1}`}
                      className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${i === index ? 'ring-[#FF2147]' : 'opacity-50 ring-transparent hover:opacity-90'}`}
                    >
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <aside className="min-h-0 overflow-y-auto border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
              <div className="p-6 sm:p-7">
                {/* A character line rather than the room type repeated — the
                    name is already in the header above. A name identifies;
                    a line gives a guest a reason to want the room. */}
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FF2147]">
                  {roomType?.name || 'The room'}
                </p>
                <h3 className="mt-2.5 font-serif text-3xl leading-tight text-[#1F3A5F]">
                  {ROOM_HEADLINES[roomType?.name] || ROOM_HEADLINES._default}
                </h3>
                <div className="mt-4 flex items-center gap-3">
                  <span className="h-px w-12 bg-[#FF2147]" />
                  <span className="h-1 w-1 rotate-45 bg-[#FF2147]" />
                </div>

                {roomType?.description && (
                  <div className="mt-5 space-y-4">
                    {roomType.description.split('\n\n').map((para, i) => (
                      <p key={i} className="text-[15px] leading-7 text-slate-600">{para}</p>
                    ))}
                  </div>
                )}

                <div className="mt-7 grid grid-cols-2 gap-2.5">
                  <Spec icon="users" label="Sleeps" value={roomType?.max_occupancy ? `Up to ${roomType.max_occupancy}` : null} />
                  <Spec icon="bed" label="Bed" value={roomType?.bed_configuration} />
                  <Spec icon="view" label="Outlook" value={roomType?.view_type} />
                  <Spec icon="balcony" label="Balcony" value={roomType ? (roomType.has_balcony ? 'Private balcony' : 'None') : null} />
                </div>

                {grouped.length > 0 && (
                  <div className="mt-9">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF2147]">In this room</p>
                    <div className="mt-4 space-y-5">
                      {grouped.map((group) => (
                        <div key={group.title}>
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-400">{group.title}</p>
                          <ul className="mt-2 space-y-1.5">
                            {group.items.map((item) => (
                              <li key={item} className="flex items-start gap-2 text-[14px] leading-6 text-slate-600">
                                <span className="mt-1 shrink-0 text-[#FF2147]"><Icon name="check" className="h-3 w-3" /></span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {facilities.length > 0 && (
                  <div className="mt-9 rounded-2xl bg-[#F5F2ED] p-6">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF2147]">Included with your stay</p>
                    <h4 className="mt-2 font-serif text-xl text-[#1F3A5F]">The hotel is yours too</h4>
                    <ul className="mt-4 space-y-2.5">
                      {facilities.map((facility) => (
                        <li key={facility.text} className="flex items-start gap-2.5 text-[14px] leading-6 text-slate-600">
                          <span className="mt-0.5 shrink-0 text-[#1F3A5F]"><Icon name={facility.icon} className="h-4 w-4" /></span>
                          {facility.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-7 rounded-xl border border-slate-200 p-5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-400">Good to know</p>
                  <div className="mt-3 space-y-1.5 text-[13.5px] leading-6 text-slate-600">
                    <p><span className="font-semibold text-[#1F3A5F]">Check-in</span> from 2:00 PM</p>
                    <p><span className="font-semibold text-[#1F3A5F]">Check-out</span> by 12:00 noon</p>
                    <p><span className="font-semibold text-[#1F3A5F]">Cancellation</span> free up to the policy cut-off</p>
                    <p><span className="font-semibold text-[#1F3A5F]">Children</span> welcome; cots on request</p>
                  </div>
                </div>
              </div>

              {roomType && (
                <div className="sticky bottom-0 border-t border-slate-200 bg-white p-6 sm:p-7">
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-3xl text-[#1F3A5F]">${rate.toFixed(2)}</span>
                    <span className="text-sm text-slate-400">per night</span>
                  </div>
                  {stayTotal != null && (
                    <p className="mt-1 text-sm text-slate-500">
                      {nights} night{nights === 1 ? '' : 's'} · ${stayTotal.toFixed(2)} before tax
                    </p>
                  )}
                  {availableCount != null && (
                    <p className={`mt-2 text-sm font-semibold ${hasAvailability ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {hasAvailability ? `${availableCount} available for your dates` : 'Not available for those dates'}
                    </p>
                  )}
                  {onBook && (
                    <button
                      type="button"
                      onClick={onBook}
                      disabled={!hasAvailability}
                      className="mt-4 w-full rounded-xl bg-[#FF2147] py-3.5 text-sm font-bold uppercase tracking-[0.06em] text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Book this room
                    </button>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {lightbox && current && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" role="dialog" aria-modal="true" aria-label="Full screen image">
          <img src={current.url} alt={current.alt_text || roomName} className="max-h-[92vh] max-w-[94vw] object-contain" />
          <button type="button" onClick={() => setLightbox(false)} aria-label="Close full screen" className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#1F3A5F] transition hover:bg-white">
            <Icon name="close" className="h-6 w-6" />
          </button>
          {safeImages.length > 1 && (
            <>
              <button type="button" onClick={() => move(-1)} aria-label="Previous" className="absolute left-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-3xl text-[#1F3A5F]">‹</button>
              <button type="button" onClick={() => move(1)} aria-label="Next" className="absolute right-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-3xl text-[#1F3A5F]">›</button>
            </>
          )}
        </div>
      )}
    </>
  )
}