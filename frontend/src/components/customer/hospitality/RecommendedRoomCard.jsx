import { useState } from 'react'
import { narrateThenListen } from '../../../lib/aliceVoice'

function Icon({ name, className = 'h-5 w-5' }) {
  const common = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'speaker') return (
    <svg {...common}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
  if (name === 'stop') return (
    <svg {...common}><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" /></svg>
  )
  return null
}

function buildRoomNarration(room) {
  const parts = [`This is ${room.room_type}, room ${room.room_number}.`]
  if (room.base_price != null) parts.push(`It's priced at $${Number(room.base_price).toFixed(2)} per night.`)
  if (room.bed_configuration) parts.push(`It features ${room.bed_configuration}.`)
  if (room.view_type) parts.push(`The room offers a ${room.view_type.toLowerCase()}.`)
  if (room.has_balcony) parts.push('It comes with a private balcony.')
  if (room.has_bathtub) parts.push('The bathroom includes a bathtub.')
  if (room.max_occupancy) parts.push(`It comfortably accommodates up to ${room.max_occupancy} guests.`)
  return parts.join(' ')
}

function ViewBadges({ room, compact }) {
  const badges = []
  if (room.view_type) badges.push(room.view_type)
  if (room.bed_configuration) badges.push(room.bed_configuration)
  if (room.has_balcony) badges.push('Balcony')
  if (room.has_bathtub) badges.push('Bathtub')

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {badges.map((label) => (
        <span key={label} className={`rounded-lg bg-slate-50 px-3 py-1.5 font-medium text-slate-600 ${compact ? 'text-[11px]' : 'text-xs'}`}>{label}</span>
      ))}
      {!compact && room.max_occupancy ? <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">Up to {room.max_occupancy} guests</span> : null}
    </div>
  )
}

export default function RecommendedRoomCard({ room, onBook, activeAudioRef, compact = false }) {
  const [speaking, setSpeaking] = useState(false)

  // Goes through the same speaking path as the rest of the conversation,
  // rather than calling the voice service itself. That is what keeps one
  // voice throughout: if the conversation has already fallen back to the
  // browser voice, this card follows it instead of sounding different.
  function narrate() {
    if (speaking) {
      activeAudioRef.current?.pause()
      window.speechSynthesis?.cancel()
      // Invalidates the shared "is this still the current line?" token, so
      // the stopped narration can't come back and finish.
      activeAudioRef.speechToken = {}
      setSpeaking(false)
      return
    }
    setSpeaking(true)
    narrateThenListen(buildRoomNarration(room), activeAudioRef, true, () => setSpeaking(false))
  }

  const imgHeight = compact ? 'h-32' : 'h-48'

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className={`relative ${imgHeight} bg-slate-100`}>
        {room.primary_image_url ? (
          <img src={room.primary_image_url} alt={room.room_type} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No image available</div>
        )}
        <button
          type="button"
          onClick={narrate}
          className={`absolute bottom-2 right-2 flex items-center justify-center rounded-full text-white backdrop-blur-sm transition ${compact ? 'h-8 w-8' : 'h-10 w-10'} ${speaking ? 'bg-[#FF2147]' : 'bg-black/70 hover:bg-black/85'}`}
          title={speaking ? 'Stop' : 'Hear about this room'}
        >
          <Icon name={speaking ? 'stop' : 'speaker'} className="h-4 w-4" />
        </button>
      </div>
      <div className={compact ? 'p-3' : 'p-5'}>
        <p className={`font-bold uppercase tracking-[0.14em] text-[#FF2147] ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{room.room_type}</p>
        <h4 className={`mt-1 font-bold text-[#1F3A5F] ${compact ? 'text-sm' : 'text-lg'}`}>Room {room.room_number}</h4>
        {room.base_price != null && <p className={`mt-1 text-slate-500 ${compact ? 'text-xs' : 'text-sm'}`}>${Number(room.base_price).toFixed(2)} / night</p>}
        <ViewBadges room={room} compact={compact} />
        <button type="button" onClick={() => onBook(room)} className={`mt-3 w-full rounded-xl bg-[#FF2147] font-bold text-white hover:bg-[#dc1539] ${compact ? 'py-2 text-xs' : 'py-2.5 text-sm'}`}>Book This Room</button>
      </div>
    </article>
  )
}