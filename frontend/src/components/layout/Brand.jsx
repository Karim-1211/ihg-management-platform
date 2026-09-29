import { useState } from 'react'

// One brand lockup for the navbar, footer and staff sidebar. The logo is
// white cutlery on a red circle, so the same file reads correctly on both
// light and dark backgrounds. If the file is missing, the text mark shows
// on its own — never a broken image, and never doubled up.
export default function Brand({ variant = 'light', size = 'md', showWordmark = true }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const onDark = variant === 'dark'

  const dims = {
    sm: { mark: 'h-8 w-8', text: 'text-xl', tag: 'text-[9px]' },
    md: { mark: 'h-10 w-10', text: 'text-2xl', tag: 'text-[10px]' },
    lg: { mark: 'h-14 w-14', text: 'text-4xl', tag: 'text-[11px]' },
  }[size]

  return (
    <span className="flex items-center gap-3">
      {!logoFailed && (
        <img
          src="/brand/logo-mark.png"
          alt=""
          onError={() => setLogoFailed(true)}
          className={`${dims.mark} shrink-0 object-contain`}
        />
      )}

      <span className={`${dims.text} font-extrabold tracking-tight ${onDark ? 'text-white' : 'text-[#1F3A5F]'}`}>
        IHG
      </span>

      {showWordmark && (
        <>
          <span className={`hidden h-6 w-px sm:block ${onDark ? 'bg-white/20' : 'bg-[#1F3A5F]/15'}`} />
          <span className={`hidden font-bold uppercase tracking-[0.22em] text-[#FF2147] sm:block ${dims.tag}`}>
            Hospitality
          </span>
        </>
      )}
    </span>
  )
}