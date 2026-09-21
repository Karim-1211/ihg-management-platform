import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

function Icon({ name, size = 16 }) {
  const c = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    pin: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
    phone: (<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.7 2Z" />),
    mail: (<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></>),
    check: (<path d="M20 6 9 17l-5-5" />),
    arrow: (<path d="M5 12h14m-6-6 6 6-6 6" />),
  }
  return <svg {...c}>{paths[name]}</svg>
}

export default function SiteFooter() {
  const [hotel, setHotel] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [zip, setZip] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    api.get('/hotels')
      .then((res) => { if (!cancelled) setHotel((res.data || [])[0] || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!email.trim() || !consent) return
    setStatus('sending')
    setMessage('')
    try {
      const res = await api.post('/newsletter/subscribe', {
        email: email.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        zip_code: zip.trim() || null,
        source: 'footer',
      })
      setStatus('done')
      setMessage(res.data?.message || "Thank you — you're on the list.")
    } catch (err) {
      setStatus('error')
      setMessage(err.response?.data?.detail || 'Something went wrong. Please try again in a moment.')
    }
  }

  const year = new Date().getFullYear()
  const fieldClass = 'w-full border-0 border-b border-white/20 bg-transparent px-0 py-3 text-[15px] text-white placeholder-white/35 outline-none transition focus:border-[#FF2147]'

  return (
    <footer className="relative left-1/2 -ml-[50vw] w-screen overflow-hidden bg-[#0B1B2D]">
      <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-[#FF2147]/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" />

      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">

        <div className="grid gap-12 py-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">

          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-4xl tracking-tight text-white">IHG</span>
              <span className="h-6 w-px bg-white/15" />
              <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#FF2147]">Hospitality</span>
            </div>

            <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/55">
              One account for your stay, your table and your delivery — from the first booking to the last bill.
            </p>

            <div className="mt-7 space-y-3 text-[15px] text-white/60">
              {hotel?.address && (
                <p className="flex items-start gap-3.5">
                  <span className="mt-1 shrink-0 text-[#FF2147]"><Icon name="pin" /></span>
                  <span className="leading-7">{hotel.address}{hotel.city ? `, ${hotel.city}` : ''}{hotel.country ? `, ${hotel.country}` : ''}</span>
                </p>
              )}
              {hotel?.phone && (
                <p className="flex items-center gap-3.5">
                  <span className="shrink-0 text-[#FF2147]"><Icon name="phone" /></span>
                  <a href={`tel:${hotel.phone}`} className="transition hover:text-white">{hotel.phone}</a>
                </p>
              )}
            </div>

            <div className="mt-7 flex flex-col gap-2.5 text-[15px]">
              {[
                { to: '/hotels', label: 'Rooms & Suites' },
                { to: '/restaurants', label: 'Restaurant & Bar' },
                { to: '/my-account', label: 'My Account' },
              ].map((link) => (
                <Link key={link.to} to={link.to} className="group flex w-fit items-center gap-2 text-white/60 transition hover:text-white">
                  {link.label}
                  <span className="text-[#FF2147] opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100"><Icon name="arrow" size={14} /></span>
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:pl-12 lg:border-l lg:border-white/[0.08]">
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#FF2147]">Get in touch</p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.12] text-white sm:text-5xl">
              Be the first<br className="hidden sm:block" /> to know.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-7 text-white/55">
              Seasonal rates, new suites and the occasional quiet midweek offer — sent sparingly,
              never shared, one click to leave whenever you like.
            </p>

            {status === 'done' ? (
              <div className="mt-10 flex items-start gap-4 border-l-2 border-[#FF2147] bg-white/[0.04] px-6 py-6">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Icon name="check" size={16} /></span>
                <p className="text-[15px] leading-7 text-white/85">{message}</p>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-7">
                <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={fieldClass} />
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={fieldClass} />
                  <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="Zip / Postcode" className={fieldClass} />
                  <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className={fieldClass} />
                </div>

                <label className="mt-6 flex cursor-pointer items-start gap-3 text-[13px] leading-6 text-white/55">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-white/25 bg-white/10 accent-[#FF2147]" />
                  <span>I'd like to receive email news and offers from IHG Hospitality.</span>
                </label>

                <button type="submit" disabled={status === 'sending' || !consent}
                  className="group mt-6 flex items-center gap-3 bg-[#FF2147] px-9 py-3.5 text-[12px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#dc1539] disabled:cursor-not-allowed disabled:opacity-35">
                  {status === 'sending' ? 'Joining…' : 'Submit'}
                  <span className="transition-transform group-hover:translate-x-1"><Icon name="arrow" size={15} /></span>
                </button>

                {status === 'error' && <p className="mt-4 text-sm text-red-300">{message}</p>}
              </form>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-white/[0.08] py-6 text-[12px] text-white/35 sm:flex-row sm:items-center">
          <p>© {year} International Hospitality Group. All rights reserved.</p>
          <p>Demo platform — payments run in test mode and no real money is charged.</p>
        </div>
      </div>
    </footer>
  )
}