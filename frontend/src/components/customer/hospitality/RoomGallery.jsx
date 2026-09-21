import { useEffect, useMemo, useState } from 'react'

export default function RoomGallery({ images = [], roomName = 'Room', onClose }) {
  const safeImages = useMemo(
    () => [...new Map(images.filter((item) => item?.url).map((item) => [item.url, item])).values()],
    [images]
  )
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    setIndex(0)
  }, [safeImages.map((item) => item.url).join('|')])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        if (lightbox) setLightbox(false)
        else onClose()
      }
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % Math.max(safeImages.length, 1))
      if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + safeImages.length) % Math.max(safeImages.length, 1))
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightbox, onClose, safeImages.length])

  if (!safeImages.length) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-5">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center">
          <h2 className="text-xl font-bold text-[#1F3A5F]">{roomName}</h2>
          <p className="mt-2 text-sm text-slate-500">No room photographs are available yet.</p>
          <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-[#1F3A5F] px-5 py-3 text-sm font-semibold text-white">Close</button>
        </div>
      </div>
    )
  }

  const current = safeImages[index]

  function move(delta) {
    setIndex((value) => (value + delta + safeImages.length) % safeImages.length)
  }

  return (
    <>
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={`${roomName} gallery`}>
        <div className="flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FF2147]">Room gallery</p>
              <h2 className="mt-1 text-xl font-bold text-[#1F3A5F]">{roomName}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close gallery" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600 hover:bg-slate-200">×</button>
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_240px]">
            <div className="relative min-h-[55vh] bg-slate-950">
              <img src={current.url} alt={current.alt_text || current.caption || roomName} className="h-full min-h-[55vh] w-full object-contain" />

              <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white hover:bg-black/70">‹</button>
              <button type="button" onClick={() => move(1)} aria-label="Next image" className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white hover:bg-black/70">›</button>

              <button type="button" onClick={() => setLightbox(true)} className="absolute bottom-4 right-4 rounded-xl bg-white/95 px-4 py-2.5 text-xs font-bold text-[#1F3A5F] shadow-lg hover:bg-white">Open full screen</button>
            </div>

            <aside className="overflow-y-auto border-l border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-semibold text-slate-500">{index + 1} of {safeImages.length}</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                {safeImages.map((image, imageIndex) => (
                  <button
                    key={image.url}
                    type="button"
                    onClick={() => setIndex(imageIndex)}
                    className={`overflow-hidden rounded-xl border-2 text-left ${imageIndex === index ? 'border-[#FF2147]' : 'border-transparent'}`}
                  >
                    <img src={image.url} alt={image.alt_text || image.caption || ''} className="aspect-[4/3] w-full object-cover" />
                    <span className="block px-2 py-2 text-[11px] font-medium text-slate-600">{image.caption || `Image ${imageIndex + 1}`}</span>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" role="dialog" aria-modal="true" aria-label={`${roomName} full screen image`}>
          <img src={current.url} alt={current.alt_text || current.caption || roomName} className="max-h-[92vh] max-w-[94vw] object-contain" />
          <button type="button" onClick={() => setLightbox(false)} aria-label="Close full screen" className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-[#1F3A5F]">×</button>
          <button type="button" onClick={() => move(-1)} aria-label="Previous image" className="absolute left-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-3xl text-[#1F3A5F]">‹</button>
          <button type="button" onClick={() => move(1)} aria-label="Next image" className="absolute right-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-3xl text-[#1F3A5F]">›</button>
        </div>
      )}
    </>
  )
}