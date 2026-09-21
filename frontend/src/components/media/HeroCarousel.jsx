import { useCallback, useEffect, useRef, useState } from 'react'
import SmartImage from './SmartImage'

const AUTO_ADVANCE_MS = 6500

/** Full-bleed editorial hero with a 3–5 image carousel. Respects
 *  prefers-reduced-motion (no auto-advance, no cross-fade). All controls
 *  are real buttons with labels and visible focus states. */
export default function HeroCarousel({ slides = [], eyebrow, headline, subline, children, height = 'h-[560px] lg:h-[640px]' }) {
  const [index, setIndex] = useState(0)
  const reducedMotion = useRef(false)

  useEffect(() => {
    reducedMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }, [])

  const count = slides.length
  const go = useCallback((next) => {
    if (count === 0) return
    setIndex(((next % count) + count) % count)
  }, [count])

  useEffect(() => {
    if (count <= 1 || reducedMotion.current) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [count])

  return (
    <section
      aria-label="Property highlights"
      className={`relative -mx-4 sm:-mx-6 lg:-mx-8 -mt-6 lg:-mt-8 overflow-hidden bg-[#132840] ${height}`}
    >
      {count === 0 && <div className="absolute inset-0 bg-gradient-to-br from-[#1F3A5F] to-[#132840]" />}

      {slides.map((slide, i) => (
        <div
          key={slide.url || i}
          aria-hidden={i !== index}
          className={`absolute inset-0 ${reducedMotion.current ? '' : 'transition-opacity duration-1000 ease-out'} ${i === index ? 'opacity-100' : 'opacity-0'}`}
        >
          <SmartImage
            src={slide.url}
            alt={slide.alt || ''}
            priority={i === 0}
            aspect=""
            className="h-full w-full"
          />
        </div>
      ))}

      {/* Elegant readability overlay — darker at the bottom-left where the copy sits */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

      <div className="relative flex h-full flex-col justify-end px-6 pb-16 sm:px-10 lg:px-14 lg:pb-20">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">{eyebrow}</p>
          )}
          <h1 className="mt-4 text-[40px] font-extrabold leading-[0.98] tracking-[-0.03em] text-white sm:text-[56px] lg:text-[68px]">
            {headline}
          </h1>
          {subline && (
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-white/75 sm:text-[17px]">{subline}</p>
          )}
          {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous image"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/25 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 19-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next image"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/25 bg-black/25 p-2.5 text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
            </svg>
          </button>

          <div className="absolute bottom-6 right-6 flex gap-2 sm:right-10 lg:right-14">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${i === index ? 'w-7 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/70'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}