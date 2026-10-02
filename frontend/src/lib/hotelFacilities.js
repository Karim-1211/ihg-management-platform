// Hotel-wide facilities are stored at the end of the hotel description
// behind a marker, so the room page can present "what comes with the hotel"
// alongside "what's in the room" without a schema change.
const MARKER = 'FACILITIES:'

// A small icon per facility, matched on keyword — a list of plain ticks
// reads as fine print; icons read as a hotel presenting itself.
const ICONS = [
  { match: ['pool', 'swim'], icon: 'pool' },
  { match: ['spa', 'hammam', 'massage'], icon: 'spa' },
  { match: ['fitness', 'gym', 'training'], icon: 'gym' },
  { match: ['breakfast', 'dining', 'restaurant', 'room dining'], icon: 'dining' },
  { match: ['bar', 'terrace', 'lounge'], icon: 'bar' },
  { match: ['transfer', 'airport', 'valet', 'parking'], icon: 'car' },
  { match: ['business', 'meeting', 'conference'], icon: 'work' },
  { match: ['wi-fi', 'wifi', 'internet'], icon: 'wifi' },
  { match: ['laundry', 'pressing', 'concierge'], icon: 'service' },
]

function iconFor(text) {
  const lower = text.toLowerCase()
  return ICONS.find((entry) => entry.match.some((m) => lower.includes(m)))?.icon || 'check'
}

export function splitHotelDescription(description) {
  if (!description) return { intro: '', facilities: [] }
  const [intro, tail] = description.split(MARKER)
  if (!tail) return { intro: description.trim(), facilities: [] }
  const facilities = tail
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
    .map((text) => ({ text, icon: iconFor(text) }))
  return { intro: (intro || '').trim(), facilities }
}