import { useState } from 'react'

/** Phase 30a.4 rebuild — one image primitive for the whole customer
 *  experience: object-cover, explicit aspect ratio (no layout shift),
 *  lazy by default with an eager/priority escape hatch for hero images,
 *  graceful fallback when a URL is missing or fails to load. */
export default function SmartImage({
  src,
  alt = '',
  className = '',
  imgClassName = '',
  aspect = 'aspect-[4/3]',
  priority = false,
  fallbackLabel = 'Image unavailable',
}) {
  const [failed, setFailed] = useState(false)
  const showFallback = !src || failed

  return (
    <div className={`relative overflow-hidden bg-stone-100 ${aspect} ${className}`}>
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">{fallbackLabel}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      )}
    </div>
  )
}