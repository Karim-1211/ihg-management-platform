import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useAliceRoomFlow } from '../../../lib/useAliceRoomFlow'
import RecommendedRoomCard from './RecommendedRoomCard'

function Icon({ name, className = 'h-5 w-5' }) {
  const common = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (name === 'speaker') return (
    <svg {...common}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )
  if (name === 'muted') return (
    <svg {...common}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
  if (name === 'mic') return (
    <svg {...common}>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
  return null
}

export default function RoomFinderAssistant({ hotelId, defaultCheckIn = '', defaultCheckOut = '', defaultGuests = 2 }) {
  const { user } = useAuth()
  const isCustomer = user?.role === 'CUSTOMER'
  const flow = useAliceRoomFlow({ hotelId, defaultCheckIn, defaultCheckOut, defaultGuests, active: isCustomer })

  const [logEndRef, setLogEndRef] = useState(null)
  const [voiceStarted, setVoiceStarted] = useState(false)

  useEffect(() => {
    logEndRef?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [flow.log, flow.replyText, logEndRef])

  const allShownRooms = [...flow.primaryRooms, ...flow.secondaryRooms]

  function handleStartVoice() {
    setVoiceStarted(true)
    flow.startVoice()
  }

  if (!isCustomer) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">
          {user ? 'AI room suggestions are available for guest accounts.' : 'Log in as a guest to chat with Alice, our AI concierge.'}
        </p>
      </div>
    )
  }

  return (
    <div id="ai-concierge-card" className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80 sm:p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FF2147]">AI Concierge</p>
          <h3 className="mt-2 text-2xl font-bold text-[#1F3A5F]">Chat with Alice</h3>
        </div>
        <button
          type="button"
          onClick={flow.toggleVoice}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
          title={flow.voiceEnabled ? "Turn Alice's voice off" : "Turn Alice's voice on"}
        >
          <Icon name={flow.voiceEnabled ? 'speaker' : 'muted'} className="h-3.5 w-3.5" />
          {flow.voiceEnabled ? 'Voice on' : 'Voice off'}
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Describe your ideal room — Alice takes it from there, checking real availability and guiding you to
        your perfect match. Speak naturally or type, whichever you prefer.
      </p>

      <div className="mt-6 max-h-[360px] space-y-3 overflow-y-auto rounded-2xl bg-slate-50 p-4">
        {flow.log.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'alice' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-6 ${m.from === 'alice' ? 'bg-white text-slate-700 ring-1 ring-slate-200' : 'bg-[#1F3A5F] text-white'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {flow.streaming && (
          <div className="flex justify-start">
            <div className="max-w-[85%] whitespace-pre-line rounded-2xl bg-white px-4 py-2.5 text-sm leading-6 text-slate-700 ring-1 ring-slate-200">
              {flow.replyText}<span className="animate-pulse">▌</span>
            </div>
          </div>
        )}
        {flow.preparingVoice && <p className="text-center text-xs text-slate-400">🔊 Alice is preparing to speak…</p>}
        <div ref={setLogEndRef} />
      </div>

      {flow.error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{flow.error}</div>}

      {flow.mic.listening && (
        <p className="mt-3 text-center text-xs font-semibold text-[#FF2147]">
          🎙 Listening… {flow.mic.interimText ? `"${flow.mic.interimText}"` : ''}
        </p>
      )}

      <div className="mt-3 min-h-[96px]">
        {flow.step === 'preference' && !voiceStarted && flow.voiceEnabled && (
          <button
            type="button"
            onClick={handleStartVoice}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF2147] py-3 text-sm font-bold text-white hover:bg-[#dc1539]"
          >
            <Icon name="mic" className="h-4 w-4" />
            Talk to Alice — hands-free from here
          </button>
        )}

        {flow.step === 'preference' && (
          <form onSubmit={(e) => { e.preventDefault(); flow.submitPreferenceValue() }}>
            <textarea
              value={flow.preference}
              onChange={(e) => flow.setPreference(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); flow.submitPreferenceValue() } }}
              rows={2}
              placeholder="e.g. A quiet room for two, with a balcony and a nice view"
              className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]"
            />
            <button type="submit" disabled={!flow.preference.trim()} className="mt-2 w-full rounded-xl bg-[#1F3A5F] py-2.5 text-sm font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Continue</button>
          </form>
        )}

        {flow.step === 'checkin' && (
          <form onSubmit={(e) => { e.preventDefault(); flow.submitCheckInValue() }} className="flex gap-3">
            <input required min={flow.today} type="date" value={flow.checkIn} onChange={(e) => flow.setCheckIn(e.target.value)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]" />
            <button type="submit" disabled={!flow.checkIn} className="rounded-xl bg-[#1F3A5F] px-6 py-3 text-sm font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Continue</button>
          </form>
        )}

        {flow.step === 'checkout' && (
          <form onSubmit={(e) => { e.preventDefault(); flow.submitCheckOutValue() }} className="flex gap-3">
            <input required min={flow.checkIn || flow.today} type="date" value={flow.checkOut} onChange={(e) => flow.setCheckOut(e.target.value)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]" />
            <button type="submit" disabled={!flow.checkOut} className="rounded-xl bg-[#1F3A5F] px-6 py-3 text-sm font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Continue</button>
          </form>
        )}

        {flow.step === 'guests' && (
          <form onSubmit={(e) => { e.preventDefault(); flow.submitGuestsValue() }} className="flex gap-3">
            <select value={flow.guests} onChange={(e) => flow.setGuests(Number(e.target.value))} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'Guest' : 'Guests'}</option>)}
            </select>
            <button type="submit" className="rounded-xl bg-[#FF2147] px-6 py-3 text-sm font-bold text-white hover:bg-[#dc1539]">Ask Alice</button>
          </form>
        )}

        {flow.step === 'searching' && <p className="text-center text-sm text-slate-400">Alice is checking availability…</p>}

        {flow.step === 'results' && allShownRooms.length > 0 && (
          <form onSubmit={(e) => { e.preventDefault(); flow.submitConfirmValue() }} className="flex gap-3">
            <input
              value={flow.confirmText}
              onChange={(e) => flow.setConfirmText(e.target.value)}
              placeholder='Say or type "yes", or a room number…'
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]"
            />
            <button type="submit" disabled={!flow.confirmText.trim()} className="rounded-xl bg-[#1F3A5F] px-6 py-3 text-sm font-bold text-white hover:bg-[#162f4d] disabled:opacity-50">Confirm</button>
          </form>
        )}

        {flow.step === 'results' && (
          <button type="button" onClick={flow.startOver} className="mt-3 w-full rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-[#1F3A5F] hover:bg-slate-50">Start a new search</button>
        )}
      </div>

      {flow.note && <p className="mt-4 text-xs italic text-slate-400">{flow.note}</p>}

      {flow.primaryRooms.length > 0 && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {flow.primaryRooms.map((room) => (
            <RecommendedRoomCard key={room.room_id} room={room} onBook={flow.bookRoom} activeAudioRef={{ current: null }} />
          ))}
        </div>
      )}

      {flow.secondaryRooms.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Also available for your dates</p>
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {flow.secondaryRooms.map((room) => (
              <RecommendedRoomCard key={room.room_id} room={room} onBook={flow.bookRoom} activeAudioRef={{ current: null }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}