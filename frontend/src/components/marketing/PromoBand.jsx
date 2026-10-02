import { useNavigate } from 'react-router-dom'

// Every claim here is something the platform actually does — late checkout
// on request, breakfast included, real delivery tracking. Nothing promises
// a discount the checkout would not honour.
function Icon({ name, className = 'h-5 w-5' }) {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
    breakfast: (<><path d="M4 8h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2M3 21h14" /></>),
    spa: (<><path d="M12 22c0-6 4-10 9-10-1 6-4 10-9 10Zm0 0c0-6-4-10-9-10 1 6 4 10 9 10Z" /><path d="M12 22V9a4 4 0 0 1 4-4" /></>),
    chef: (<><path d="M6 13a4 4 0 1 1 2-7.5 4.5 4.5 0 0 1 8 0A4 4 0 1 1 18 13v6H6v-6Z" /><path d="M6 17h12" /></>),
    glass: (<><path d="m5 4 7 8 7-8ZM12 12v7M8 19h8" /></>),
    table: (<><path d="M3 10h18M5 10v10M19 10v10M4 6h16l1 4H3Z" /></>),
    scooter: (<><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 18h6M15 18V7a2 2 0 0 1 2-2h2M6 15V9h5l3 6" /></>),
    star: (<path d="m12 3 2.6 5.8 6.4.7-4.8 4.3 1.3 6.2L12 17l-5.5 3 1.3-6.2L3 9.5l6.4-.7Z" />),
    track: (<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>),
  }
  return <svg {...c}>{paths[name]}</svg>
}

const CONTENT = {
  hotel: {
    image: 'https://images.unsplash.com/photo-1739304150315-26a8676d01ef?fm=jpg&q=80&w=2000&auto=format&fit=crop',
    eyebrow: 'Staying with us',
    heading: 'Every night includes\nrather more than a bed.',
    copy: 'The rooftop pool, the spa, the fitness studio and breakfast are part of the rate — not extras added at checkout. Book direct and they always are.',
    points: [
      { icon: 'breakfast', title: 'Breakfast included', copy: 'Served 6:30 – 10:30, every morning of your stay.' },
      { icon: 'spa', title: 'Pool, spa & studio', copy: 'Open to every guest, no day-pass, no supplement.' },
      { icon: 'clock', title: 'Late checkout on request', copy: 'Ask at reception — we accommodate it whenever the room allows.' },
    ],
    cta: { label: 'Browse rooms & suites', to: '/hotels' },
  },
  restaurant: {
    image: 'https://images.unsplash.com/photo-1695641738244-25e5355e9a42?fm=jpg&q=80&w=2000&auto=format&fit=crop',
    eyebrow: 'At the table',
    heading: 'A room worth lingering in,\na menu worth returning for.',
    copy: 'Forty dishes across five sections, cooked to order, with the kitchen list live on this page. What you see here is what is on tonight.',
    points: [
      { icon: 'table', title: 'Live table availability', copy: 'We check the floor plan as you search — no waiting to hear back.' },
      { icon: 'glass', title: 'Happy hour, 5 – 7 daily', copy: 'Spritzes, small plates and the bar list at its best.' },
      { icon: 'chef', title: "Chef's signatures", copy: 'Marked on the menu, and worth the extra few minutes.' },
    ],
    cta: { label: 'Book a table', to: '/restaurants' },
  },
  delivery: {
    image: 'https://images.pexels.com/photos/299348/pexels-photo-299348.jpeg?auto=compress&cs=tinysrgb&w=2000',
    eyebrow: 'To your door',
    heading: 'The same kitchen.\nThe same care.',
    copy: 'Delivery is not a separate operation with a shorter menu. It is the dining room kitchen, cooking the same dishes, packed to travel.',
    points: [
      { icon: 'scooter', title: 'Cooked to order', copy: 'Nothing sits waiting — preparation starts when you pay.' },
      { icon: 'track', title: 'Tracked to the door', copy: 'Every step, from the kitchen to your rider, updating itself.' },
      { icon: 'star', title: 'Order again in one tap', copy: 'Your last order, rebuilt from what is on the menu today.' },
    ],
    cta: { label: 'Order delivery', to: '/delivery' },
  },
}

export default function PromoBand({ kind = 'hotel', onCta = null }) {
  const navigate = useNavigate()
  const content = CONTENT[kind] || CONTENT.hotel

  // The footer already holds the subscribe form — scrolling to it beats
  // maintaining a second copy of the same form in every band.
  function scrollToSubscribe() {
    const target = document.getElementById('subscribe')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const input = target.querySelector('input[type="email"]')
      if (input) window.setTimeout(() => input.focus(), 700)
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }
  }

  return (
    <section className="relative overflow-hidden bg-[#0E2036] px-4 py-24 sm:px-6 lg:px-8">
      <img src={content.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0E2036] via-[#0E2036]/92 to-[#0E2036]/55" />
      <div className="pointer-events-none absolute -left-40 top-0 h-96 w-96 rounded-full bg-[#FF2147]/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1280px] gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#FF2147]">{content.eyebrow}</p>
          <h2 className="mt-4 whitespace-pre-line font-serif text-5xl leading-[1.08] text-white sm:text-6xl">
            {content.heading}
          </h2>
          <p className="mt-6 max-w-lg text-[17px] leading-8 text-white/60">{content.copy}</p>

          {/* The subscriber offer repeated here, where a guest who dismissed
              the popup will still meet it — with a way to act on it, which an
              offer without a button never gave them. */}
          <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl border border-[#FF2147]/30 bg-[#FF2147]/10 px-6 py-5">
            <span className="rounded-full bg-[#FF2147] px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.1em] text-white">
              10% off
            </span>
            <span className="min-w-[200px] flex-1 text-[15px] font-bold leading-6 text-white">
              Subscribe and save on your next booking, table or delivery.
            </span>
            <button
              type="button"
              onClick={scrollToSubscribe}
              className="shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#1F3A5F] transition hover:-translate-y-0.5 hover:bg-[#F0EBE3]"
            >
              Subscribe now
            </button>
          </div>

          <button
            type="button"
            onClick={() => (onCta ? onCta() : navigate(content.cta.to))}
            className="mt-8 block rounded-xl bg-[#FF2147] px-9 py-4 text-sm font-bold uppercase tracking-[0.08em] text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-[#dc1539]"
          >
            {content.cta.label}
          </button>
        </div>

        <div className="space-y-4">
          {content.points.map((point) => (
            <div
              key={point.title}
              className="group flex gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition hover:border-[#FF2147]/40 hover:bg-white/[0.07]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#FF2147]/15 text-[#FF2147] transition group-hover:bg-[#FF2147] group-hover:text-white">
                <Icon name={point.icon} />
              </span>
              <div>
                <h3 className="font-serif text-xl text-white">{point.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-6 text-white/55">{point.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}