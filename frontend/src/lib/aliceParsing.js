// Everything Alice needs to turn a spoken sentence into data — kept in one
// pure module (no React, no network) so it can be tested on its own and
// shared by every page that talks to her.

// ---------- What kind of message is it? ----------

const SMALL_TALK_LINES = {
  greeting: "Hello, and welcome! It's lovely to meet you. What kind of room are you hoping for — a view of the mountains or the water, a balcony, a quiet floor?",
  howAreYou: "I'm very well, thank you for asking — and I hope your day is going beautifully. Now, what kind of room can I find for you?",
  help: "I can find the right room for you and check live availability. Just tell me what matters most — the view, a balcony, the bed, a quiet floor — and I'll take it from there.",
  thanks: "My pleasure. Whenever you're ready, tell me what you'd like in a room — a view, a balcony, anything at all.",
  moveOn: "No problem at all — I'll show you everything that's free. What date would you like to check in?",
}
export { SMALL_TALK_LINES }

// Deliberately broad: a real wish wrongly treated as small talk is more
// annoying than small talk that slips through.
const ROOM_WORDS = /\b(rooms?|suites?|views?|mountains?|lakes?|ocean|sea|beach|water|city|skyline|garden|balcony|terrace|quiet|calm|peaceful|bed|beds|king|queen|twin|double|single|bath|bathtub|tub|shower|floor|high|top|ground|family|kids|children|child|baby|couple|honeymoon|anniversary|birthday|romantic|business|work|desk|spacious|large|big|small|cozy|cosy|luxury|luxurious|cheap|budget|affordable|price|cost|deluxe|standard|premium|window|sunrise|sunset|guests?|people|persons|adults?|nights?|stay|staying|accessible|wheelchair|pool|spa|breakfast|smoking|pet|pets|any|anything|whatever|available|availability|book|booking|reserve|reservation|looking)\b/
const PARTY_SIZE = /\b(\d+|one|two|three|four|five|six)\b.*\b(of us|people|persons|guests?|adults?)\b/
const HOW_ARE_YOU = /\bhow (are|r) (you|u|things)\b|\bhow'?s it going\b|\bhow do you do\b|\bhow have you been\b/
const GREETING = /^(hi+|hello+|hey+|hiya|howdy|yo|greetings|good (morning|afternoon|evening|day)|salam|assalamu?|as-salamu|hola|bonjour|namaste)\b/
const HELP = /\b(help|what can you do|who are you|what are you|how does (this|it) work)\b/
const THANKS = /^(thanks|thank you|thx|cheers|ok|okay|cool|great|nice|fine|good|alright|perfect|sure)\b/

// A room wish wins over everything else, so "hi, I'd like a sea view"
// moves straight on rather than getting a hello back.
export function classifyPreference(text) {
  const t = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}\s'$-]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return 'unclear'
  if (ROOM_WORDS.test(t) || PARTY_SIZE.test(t)) return 'room'
  if (HOW_ARE_YOU.test(t)) return 'howAreYou'
  if (GREETING.test(t)) return 'greeting'
  if (HELP.test(t)) return 'help'
  if (THANKS.test(t)) return 'thanks'
  return 'unclear'
}

// ---------- Numbers spoken as words ----------

const ONES = { zero: 0, oh: 0, o: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 }
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 }
// Speech-to-text hears small numbers as these words.
const HOMOPHONES = { won: 1, to: 2, too: 2, tree: 3, for: 4, fore: 4, ate: 8 }

const ORDINAL_ONES = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 }
const ORDINAL_TEENS = { tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19 }
const ORDINAL_TENS = { twentieth: 20, thirtieth: 30 }

const pad2 = (n) => String(n).padStart(2, '0')
const isDigitsToken = (w) => /^\d+$/.test(w)
const isNumberWord = (w) => w in ONES || w in TEENS || w in TENS || w === 'hundred'

function wordsOf(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
}

// Turns one run of number tokens into the digits it was spoken as.
function runToDigits(run) {
  let out = ''
  let i = 0
  const readBelowHundred = () => {
    // Reads "three", "ten", "twenty five", "twenty" starting at i; returns 0-99.
    const w = run[i]
    if (w in TENS) {
      let v = TENS[w]
      i += 1
      if (i < run.length && run[i] in ONES && ONES[run[i]] > 0 && run[i] !== 'o' && run[i] !== 'oh') { v += ONES[run[i]]; i += 1 }
      return v
    }
    if (w in TEENS) { i += 1; return TEENS[w] }
    if (w in ONES) { i += 1; return ONES[w] }
    return null
  }

  while (i < run.length) {
    const w = run[i]
    if (isDigitsToken(w)) { out += w; i += 1; continue }

    // "one hundred three", "one hundred and three", "two hundred twenty five"
    if (w in ONES && run[i + 1] === 'hundred') {
      const hundreds = ONES[w]
      i += 2
      if (run[i] === 'and') i += 1
      let rest = 0
      if (i < run.length && !isDigitsToken(run[i]) && run[i] !== 'hundred') {
        const v = readBelowHundred()
        if (v !== null) rest = v
      }
      out += `${hundreds}${pad2(rest)}`
      continue
    }

    // "ten three" -> 103 (room 103 said as "ten three"), "twenty one" -> 21
    if (w in TENS || w in TEENS) {
      const v = readBelowHundred()
      out += String(v)
      continue
    }
    if (w in ONES) { out += String(ONES[w]); i += 1; continue }
    i += 1 // a stray "hundred" or "and"
  }
  return out
}

// Every number-like run in the sentence, as digit strings.
// "it's one oh three please" -> ['103']; "one hundred and three" -> ['103']
export function digitsFromWords(text) {
  const found = []
  let run = []
  const flush = () => { if (run.length) { const d = runToDigits(run); if (d) found.push(d); run = [] } }

  for (const w of wordsOf(text)) {
    if (isDigitsToken(w) || isNumberWord(w)) { run.push(w); continue }
    if (w === 'and' && run.length && run[run.length - 1] === 'hundred') { run.push(w); continue }
    flush()
  }
  flush()
  return found
}

// ---------- Rooms ----------

// Speech-to-text hears number words as ordinary words: "four oh two" comes
// back as "for oh two", "three" as "free" or "tree".
function fixNumberHomophones(text) {
  return text
    .replace(/\b(for|fore)\b/g, 'four')
    .replace(/\b(to|too)\b/g, 'two')
    .replace(/\b(free|tree|thee)\b/g, 'three')
    .replace(/\b(won)\b/g, 'one')
    .replace(/\b(ate)\b/g, 'eight')
    .replace(/\b(nein|nine?)\b/g, 'nine')
    .replace(/\b(sex|sics)\b/g, 'six')
}

export function matchRoomFromText(text, rooms) {
  const direct = matchRoomOnce(text, rooms)
  if (direct) return direct
  const cleaned = fixNumberHomophones(String(text || '').toLowerCase())
  return cleaned === String(text || '').toLowerCase() ? null : matchRoomOnce(cleaned, rooms)
}

function matchRoomOnce(text, rooms) {
  const normalized = String(text || '').trim().toLowerCase()
  if (!normalized || !rooms?.length) return null
  const numberOf = (r) => String(r.room_number).toLowerCase()

  const spoken = digitsFromWords(normalized)

  // 1. The number said is exactly a room we showed.
  for (const n of spoken) {
    const hit = rooms.find((r) => numberOf(r) === n)
    if (hit) return hit
  }
  // 2. A room number sits inside a longer run of digits ("room one oh three please one").
  for (const n of spoken) {
    if (n.length < 3) continue
    const hit = rooms.find((r) => numberOf(r).length >= 3 && n.includes(numberOf(r)))
    if (hit) return hit
  }
  // 3. The guest dropped a leading digit, as in "oh three" for 103 — only when unique.
  for (const n of spoken) {
    if (n.length < 2) continue
    const hits = rooms.filter((r) => numberOf(r).endsWith(n))
    if (hits.length === 1) return hits[0]
  }
  // 4. A plain yes, when there is exactly one room to say yes to.
  if (/^(yes|yeah|yep|sure|okay|ok|please|book it|that one|go ahead|correct|that'?s right|sounds good)\b/.test(normalized) && rooms.length === 1) {
    return rooms[0]
  }
  // 5. "the first one", "second", "the last one"
  const ordinal = normalized.match(/\b(first|1st|second|2nd|third|3rd|fourth|4th|last)\b/)
  if (ordinal) {
    const idx = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3 }[ordinal[1]]
    if (ordinal[1] === 'last') return rooms[rooms.length - 1]
    if (rooms[idx]) return rooms[idx]
  }
  // 6. The number typed, or a room type named.
  const byNumber = rooms.find((r) => normalized.includes(numberOf(r)))
  if (byNumber) return byNumber
  const byType = rooms.find((r) => r.room_type && normalized.includes(String(r.room_type).toLowerCase()))
  if (byType) return byType
  return null
}

// ---------- Dates ----------

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }

// A date this year if it has not passed yet — today counts as not passed —
// otherwise next year.
function guessYear(monthIndex, day, now) {
  const candidate = new Date(now.getFullYear(), monthIndex, day)
  return candidate < startOfDay(now) ? now.getFullYear() + 1 : now.getFullYear()
}

// null for dates that don't exist, such as the 31st of June.
function isoDate(year, monthIndex, day) {
  const d = new Date(year, monthIndex, day)
  if (d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) return null
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// "20th", "twentieth", "twenty second", "twenty two", "5" -> day of month
function dayFromText(t) {
  const digit = t.match(/\b(\d{1,2})(?:st|nd|rd|th|s|n|r|d|t)?\b/)
  if (digit) return Number(digit[1])
  const words = wordsOf(t)
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]
    if (w in ORDINAL_TENS) return ORDINAL_TENS[w]
    if (w in TENS && (TENS[w] === 20 || TENS[w] === 30)) {
      const next = words[i + 1]
      if (next in ORDINAL_ONES) return TENS[w] + ORDINAL_ONES[next]
      if (next in ONES && ONES[next] > 0 && next !== 'o' && next !== 'oh') return TENS[w] + ONES[next]
      return TENS[w]
    }
    if (w in ORDINAL_TEENS) return ORDINAL_TEENS[w]
    if (w in TEENS) return TEENS[w]
    if (w in ORDINAL_ONES) return ORDINAL_ONES[w]
    if (w in ONES && ONES[w] > 0 && w !== 'o') return ONES[w]
  }
  return null
}

export function parseSpokenDate(text, now = new Date()) {
  const t = String(text || '').toLowerCase().trim()
  if (!t) return null

  const iso = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return isoDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))

  if (/\btoday\b|\btonight\b/.test(t)) return isoDate(now.getFullYear(), now.getMonth(), now.getDate())
  if (/\btomorrow\b/.test(t)) { const n = new Date(now); n.setDate(n.getDate() + 1); return isoDate(n.getFullYear(), n.getMonth(), n.getDate()) }

  const slash = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (slash) {
    const mm = Number(slash[1]) - 1
    const dd = Number(slash[2])
    const yr = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : guessYear(mm, dd, now)
    return isoDate(yr, mm, dd)
  }

  for (let i = 0; i < MONTHS.length; i += 1) {
    const full = new RegExp(`\\b${MONTHS[i]}\\b`)
    const short = MONTHS[i] === 'may' ? null : new RegExp(`\\b${MONTHS[i].slice(0, 3)}\\.?\\b`)
    if (!full.test(t) && !(short && short.test(t))) continue

    const yearMatch = t.match(/\b(20\d{2})\b/)
    const rest = yearMatch ? t.replace(yearMatch[0], ' ') : t
    // Remove the month name so "august" is never mistaken for a day word.
    const withoutMonth = rest.replace(full, ' ').replace(short || /$^/, ' ')
    const day = dayFromText(withoutMonth)
    if (!day) return null
    return isoDate(yearMatch ? Number(yearMatch[1]) : guessYear(i, day, now), i, day)
  }
  return null
}

// ---------- Guests ----------

export function parseSpokenGuests(text) {
  const t = String(text || '').toLowerCase()
  if (/\b(just me|only me|myself|solo|alone|by myself)\b/.test(t)) return 1
  if (/\b(a couple|couple of|the two of us|both of us)\b/.test(t)) return 2

  const digit = t.match(/\b(\d{1,2})\b/)
  if (digit) { const n = Number(digit[1]); if (n >= 1 && n <= 6) return n; if (n > 6) return 6 }

  for (const w of wordsOf(t)) {
    if (w in ONES && ONES[w] >= 1 && ONES[w] <= 6) return ONES[w]
  }
  const beforeNoun = t.match(/\b([a-z]+)\s+(guests?|people|persons?|pax|of us|adults?)\b/)
  if (beforeNoun && HOMOPHONES[beforeNoun[1]] != null) return Math.min(6, HOMOPHONES[beforeNoun[1]])
  const only = wordsOf(t)
  if (only.length === 1 && HOMOPHONES[only[0]] != null) return HOMOPHONES[only[0]]
  return null
}

// ---------- What Alice says about the results ----------

const priceOf = (r) => {
  const p = Number(r.base_price)
  return Number.isFinite(p) && p > 0 ? ` at $${Math.round(p)} a night` : ''
}

// The spoken summary of a search is built here from the rooms themselves, so
// it is instant and always matches the cards on screen. The long wording a
// language model would write takes seconds to generate and to speak.
export function describeResults(rooms, { fallback = '' } = {}) {
  if (!rooms?.length) {
    return { text: fallback || "I'm sorry — I couldn't find a room free for those dates. Would you like to try different dates?", prompt: '' }
  }
  const top = rooms.slice(0, 3)
  const label = (r) => `Room ${r.room_number}${r.room_type ? `, a ${r.room_type}` : ''}${priceOf(r)}`

  if (rooms.length === 1) {
    return { text: `I found one room for you: ${label(rooms[0])}. Would you like me to book it? Just say yes.`, prompt: '' }
  }
  const list = top.length === 2
    ? `${label(top[0])}, and ${label(top[1])}`
    : `${label(top[0])}; ${label(top[1])}; and ${label(top[2])}`
  const more = rooms.length > 3 ? ` There are ${rooms.length - 3} more below.` : ''
  return { text: `I found ${rooms.length} rooms for you: ${list}.${more} Which room would you like? Just say the number.`, prompt: '' }
}

// ---------- Speaking in pieces ----------

// Splits a reply so the first sentence can start playing while the rest is
// still to be prepared — the guest hears Alice sooner.
export function splitForSpeech(text, maxFirst = 140) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  if (clean.length <= maxFirst) return [clean]
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [clean]
  let first = sentences[0].trim()
  let used = 1
  while (used < sentences.length && (first.length + sentences[used].trim().length + 1) <= maxFirst) {
    first += ` ${sentences[used].trim()}`
    used += 1
  }
  const rest = sentences.slice(used).join(' ').trim()
  return rest ? [first, rest] : [first]
}