import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../../services/api'

// Dismissal is remembered PER PAGE KIND: closing the hotel invitation should
// not silence the restaurant and delivery ones, which offer different things.
// Subscribing, on the other hand, stops all of them.
const DISMISS_PREFIX = 'ihg_subscribe_dismissed_v2_'
const SIGNED_KEY = 'ihg_subscribe_done_v1'

// A popup that appears the moment a page loads is the fastest way to make a
// premium site feel cheap. This waits until the visitor has shown some
// interest: either real reading time, or a meaningful scroll.
const DELAY_MS = 25000
const SCROLL_TRIGGER = 0.35

// Never interrupt someone who is paying, signing in, or managing an order.
const BLOCKED = ['/checkout', '/login', '/register', '/my-account', '/staff', '/delivery/orders']

// Every headline benefit is something the platform genuinely delivers today
// — breakfast and the spa really are included in the rate, happy hour really
// runs 5–7, delivery really is tracked. Nothing here promises a discount the
// checkout would not honour.
const OFFERS = {
  hotel: {
    image: 'https://images.unsplash.com/photo-1651830949817-7642bdf5397e?fm=jpg&q=80&w=1400&auto=format&fit=crop',
    eyebrow: 'Member rates',
    badge: 'Breakfast included',
    heading: 'Stay a little\nlonger.',
    promise: 'Every night already includes breakfast, the rooftop pool and the spa. Join the list and we tell you first when the quiet weeks open up.',
    lines: [
      { strong: 'Breakfast & spa included', rest: 'in every rate, never an extra' },
      { strong: 'Late checkout', rest: 'on request, whenever the room allows' },
      { strong: 'Seasonal rates first', rest: 'before they reach the public page' },
    ],
    source: 'popup_hotel',
  },
  restaurant: {
    image: 'https://images.pexels.com/photos/8697542/pexels-photo-8697542.jpeg?auto=compress&cs=tinysrgb&w=1400',
    eyebrow: 'The kitchen list',
    badge: 'Happy hour 5 – 7 daily',
    heading: 'A seat at the\nchef\'s table.',
    promise: 'Forty dishes, five sections, changed with the seasons. We write when the menu turns — and when a tasting evening opens up.',
    lines: [
      { strong: 'Happy hour, 5 – 7', rest: 'spritzes and small plates, every day' },
      { strong: "Chef's table evenings", rest: 'by invitation, to the list first' },
      { strong: 'New menus early', rest: 'before they appear on the board' },
    ],
    source: 'popup_restaurant',
  },
  delivery: {
    image: 'https://images.pexels.com/photos/3791089/pexels-photo-3791089.jpeg?auto=compress&cs=tinysrgb&w=1400',
    eyebrow: 'Straight to your door',
    badge: 'Tracked door to door',
    heading: 'The same kitchen.\nYour sofa.',
    promise: 'Not a shorter delivery menu — the dining room kitchen, cooking the same dishes to order. We write when something new lands.',
    lines: [
      { strong: 'Cooked to order', rest: 'nothing sits waiting under a lamp' },
      { strong: 'Tracked to the door', rest: 'every step, updating by itself' },
      { strong: 'Weekend specials', rest: 'sent Friday morning, to the list only' },
    ],
    source: 'popup_delivery',
  },
}

function kindFor(pathname) {
  if (pathname.startsWith('/delivery')) return 'delivery'
  if (pathname.startsWith('/restaurants')) return 'restaurant'
  return 'hotel'
}

function Icon({ name, className = 'h-4 w-4' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    close: (<path d="M6 18 18 6M6 6l12 12" />),
    check: (<path d="M20 6 9 17l-5-5" />),
    mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

export default function SubscribePopup() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [promoCode, setPromoCode] = useState(null)
  const [promoPercent, setPromoPercent] = useState(null)
  const [copied, setCopied] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const kind = kindFor(location.pathname)
  const offer = OFFERS[kind]
  const blocked = BLOCKED.some((path) => location.pathname.startsWith(path))

  useEffect(() => {
    if (blocked || open) return undefined
    try {
      if (window.localStorage.getItem(SIGNED_KEY)) return undefined
      if (window.localStorage.getItem(DISMISS_PREFIX + kind)) return undefined
    } catch {
      // Storage unavailable — show it once this visit rather than never.
    }

    let done = false
    const show = () => {
      if (done) return
      done = true
      setOpen(true)
    }

    const timer = window.setTimeout(show, DELAY_MS)
    const onScroll = () => {
      const scrolled = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight)
      if (scrolled > SCROLL_TRIGGER) show()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [blocked, open, kind, location.pathname])

  useEffect(() => {
    if (!open) return undefined
    function onKey(e) { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  function dismiss() {
    setOpen(false)
    // A dismissal is a decision — remember it, but only for this page kind.
    try { window.localStorage.setItem(DISMISS_PREFIX + kind, String(Date.now())) } catch { /* ignore */ }
  }

  async function submit(e) {
    e.preventDefault()
    if (!email.trim() || !consent) return
    setStatus('sending')
    setMessage('')
    try {
      const res = await api.post('/newsletter/subscribe', {
        email: email.trim(),
        first_name: firstName.trim() || null,
        last_name: null,
        source: offer.source,
      })
      setStatus('done')
      setMessage(res.data?.message || "You're on the list.")
      setPromoCode(res.data?.promo_code || null)
      setPromoPercent(res.data?.promo_percent_off || null)
      try { window.localStorage.setItem(SIGNED_KEY, String(Date.now())) } catch { /* ignore */ }
    } catch (err) {
      setStatus('error')
      setMessage(err.response?.data?.detail || 'Something went wrong. Please try again in a moment.')
    }
  }

  if (!open || blocked) return null

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/35 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Join the IHG list"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-[0_40px_100px_-30px_rgba(15,23,42,0.6)]">
        {/* An explicit label beside the X: a close icon alone leaves people
            hunting, and clicking outside should never be the only way out. */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-[#1F3A5F]"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-lg backdrop-blur-sm transition hover:bg-white hover:text-[#1F3A5F]"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-2">
          <div className="relative hidden min-h-[440px] bg-[#0E2036] md:block">
            <img src={offer.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E2036] via-[#0E2036]/45 to-transparent" />
            <span className="absolute left-7 top-7 rounded-full bg-[#FF2147] px-5 py-2.5 text-[13px] font-extrabold uppercase tracking-[0.1em] text-white shadow-lg">
              Subscribe &amp; save 10%
            </span>
            <span className="absolute left-7 top-[70px] rounded-full bg-white/90 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1F3A5F] backdrop-blur-sm">
              {offer.badge}
            </span>
            <div className="absolute inset-x-0 bottom-0 p-9">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#FF2147]">{offer.eyebrow}</p>
              <h2 className="mt-3 whitespace-pre-line font-serif text-4xl leading-tight text-white">{offer.heading}</h2>
              <p className="mt-4 max-w-sm text-[14px] leading-6 text-white/60">{offer.promise}</p>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="flex items-center gap-3">
              {!logoFailed && (
                <img
                  src="/brand/logo-mark.png"
                  alt=""
                  onError={() => setLogoFailed(true)}
                  className="h-9 w-9 shrink-0 object-contain"
                />
              )}
              <span className="text-xl font-extrabold tracking-tight text-[#1F3A5F]">IHG</span>
              <span className="h-5 w-px bg-[#1F3A5F]/15" />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF2147]">Hospitality</span>
            </div>

            {status === 'done' ? (
              <div className="py-10 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Icon name="check" className="h-7 w-7" />
                </span>
                <h3 className="mt-6 font-serif text-3xl text-[#1F3A5F]">You're on the list.</h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-500">{message}</p>

                {promoCode && (
                  <div className="mt-6 rounded-2xl border-2 border-dashed border-[#FF2147]/40 bg-[#FF2147]/[0.04] p-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      {promoPercent ? `${Math.round(promoPercent * 100)}% off your next` : 'Your code'}
                    </p>
                    <p className="mt-1 text-[13px] text-slate-500">booking, table or delivery</p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(promoCode)
                        setCopied(true)
                        window.setTimeout(() => setCopied(false), 2000)
                      }}
                      title="Copy to clipboard"
                      className="mt-4 w-full rounded-xl bg-white px-4 py-4 font-mono text-2xl font-bold tracking-[0.2em] text-[#1F3A5F] shadow-sm ring-1 ring-slate-200 transition hover:ring-[#FF2147]"
                    >
                      {promoCode}
                    </button>
                    <p className="mt-2.5 text-xs text-slate-400">
                      {copied ? 'Copied.' : "Tap to copy — it's in your inbox too."}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-7 rounded-xl bg-[#1F3A5F] px-8 py-3.5 text-sm font-bold text-white transition hover:bg-[#162f4d]"
                >
                  Continue browsing
                </button>
              </div>
            ) : (
              <>
                <h3 className="mt-7 font-serif text-3xl leading-tight text-[#1F3A5F] md:hidden">
                  {offer.heading.replace('\n', ' ')}
                </h3>

                {/* The offer stated plainly — a guest should not have to infer
                    what they get for handing over an email address. */}
                <p className="mt-7 text-[19px] font-bold leading-8 text-[#1F3A5F]">
                  Subscribe and take <span className="text-[#FF2147]">10% off</span> your next booking, table or delivery.
                </p>
                <p className="mt-2 text-[14px] leading-6 text-slate-500">
                  Your code arrives instantly and is valid for 90 days, across the hotel, the restaurant and delivery.
                </p>

                <span className="mt-6 inline-block rounded-full bg-[#FF2147]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF2147] md:hidden">
                  {offer.badge}
                </span>

                <ul className="mt-6 space-y-3">
                  {offer.lines.map((line) => (
                    <li key={line.strong} className="flex items-start gap-3 text-[14.5px] leading-6">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF2147]/10 text-[#FF2147]">
                        <Icon name="check" className="h-3 w-3" />
                      </span>
                      <span className="text-slate-600">
                        <span className="font-bold text-[#1F3A5F]">{line.strong}</span> — {line.rest}
                      </span>
                    </li>
                  ))}
                </ul>

                <form onSubmit={submit} className="mt-7">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name (optional)"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3.5 text-[15px] outline-none transition focus:border-[#1F3A5F] focus:ring-2 focus:ring-[#1F3A5F]/10"
                  />
                  <div className="relative mt-3">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="mail" /></span>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email address"
                      className="w-full rounded-xl border border-slate-300 py-3.5 pl-11 pr-4 text-[15px] outline-none transition focus:border-[#1F3A5F] focus:ring-2 focus:ring-[#1F3A5F]/10"
                    />
                  </div>

                  <label className="mt-4 flex cursor-pointer items-start gap-3 text-[13px] leading-6 text-slate-500">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#FF2147]"
                    />
                    <span>I'd like to receive email news and offers from IHG Hospitality.</span>
                  </label>

                  <button
                    type="submit"
                    disabled={status === 'sending' || !consent}
                    className="mt-5 w-full rounded-xl bg-[#FF2147] py-4 text-sm font-bold uppercase tracking-[0.06em] text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {status === 'sending' ? 'Joining…' : 'Join the list'}
                  </button>

                  {status === 'error' && <p className="mt-3 text-center text-sm text-red-600">{message}</p>}

                  <button
                    type="button"
                    onClick={dismiss}
                    className="mt-4 w-full text-center text-xs text-slate-400 transition hover:text-slate-600"
                  >
                    No thanks, I'll keep browsing
                  </button>
                </form>

                <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
                  One click to leave, whenever you like. We never share your address.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}