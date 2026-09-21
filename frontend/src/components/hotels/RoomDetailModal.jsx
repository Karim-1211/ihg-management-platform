import { useCallback, useEffect, useState } from 'react'
import api from '../../services/api'
import SmartImage from '../media/SmartImage'

function Spec({ label, value }) {
  if (!value) return null
  return (
    <div className="border-t border-stone-200 py-3">
      <dt className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-stone-400">{label}</dt>
      <dd className="mt-1 text-[14px] font-medium text-navy">{value}</dd>
    </div>
  )
}

export default function RoomDetailModal({ roomType, availableCount, onClose, onBook }) {
  const [images, setImages] = useState([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!roomType) return
    let cancelled = false
    api.get('/media', { params: { entity_type: 'ROOM_TYPE', entity_id: roomType.id } })
      .then((res) => { if (!cancelled) setImages(res.data || []) })
      .catch(() => { if (!cancelled) setImages([]) })
    return () => { cancelled = true }
  }, [roomType])

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

  if (!roomType) return null

  const hasAvailability = (availableCount ?? 0) > 0

  const mainImage = images[active]?.url || roomType.primary_image_url

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={roomType.name}>
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="relative">
          <SmartImage src={mainImage} alt={images[active]?.alt_text || roomType.name} aspect="aspect-[16/9]" priority />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close room details"
            className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          {count > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" /></svg>
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition-colors hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" /></svg>
              </button>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="flex gap-2 overflow-x-auto px-6 pt-4">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === active}
                className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy ${i === active ? 'border-navy' : 'border-transparent opacity-70 hover:opacity-100'}`}
              >
                <SmartImage src={img.url} alt="" aspect="" className="h-full w-full" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-navy">{roomType.name}</h2>
            {roomType.description && <p className="mt-3 text-[15px] leading-7 text-stone-600">{roomType.description}</p>}

            {roomType.amenities?.length > 0 && (
              <div className="mt-6">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-stone-400">In this room</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {roomType.amenities.map((a) => (
                    <span key={a} className="rounded-full border border-stone-200 px-3 py-1 text-[12px] font-medium text-stone-600">{a}</span>
                  ))}
                  {roomType.has_balcony && <span className="rounded-full border border-stone-200 px-3 py-1 text-[12px] font-medium text-stone-600">Balcony</span>}
                  {roomType.has_bathtub && <span className="rounded-full border border-stone-200 px-3 py-1 text-[12px] font-medium text-stone-600">Bathtub</span>}
                </div>
              </div>
            )}
          </div>

          <div>
            <dl>
              <Spec label="Sleeps" value={roomType.max_occupancy ? `Up to ${roomType.max_occupancy} guests` : null} />
              <Spec label="Bed" value={roomType.bed_configuration} />
              <Spec label="View" value={roomType.view_type} />
              <Spec label="Rate" value={`$${roomType.base_price} per night`} />
            </dl>

            {availableCount != null && (
              <p className="mt-4 text-[13px] font-semibold text-navy">
                {hasAvailability ? `${availableCount} available for your dates` : 'Not available for your dates'}
              </p>
            )}

            <button
              type="button"
              onClick={onBook}
              className="mt-5 w-full rounded-xl bg-red py-3 text-[14px] font-bold text-white transition-colors hover:bg-red-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
            >
              {hasAvailability ? 'Book this room' : 'Check availability'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}