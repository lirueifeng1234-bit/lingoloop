// Keepsakes — the daily collectible that makes finishing the loop feel like
// unwrapping something. One C1–C2 expression is assigned to each calendar day
// (deterministic, same for any reload). Finishing today's full loop unseals
// today's card; any past day with practice already owns its card — so the
// collection is derived entirely from practice_sessions, no migration needed.

// 48 expressions, curated for an advanced learner: idioms and turns of phrase
// natives actually use, tuned toward opinion, work, money, and health talk.
export const KEEPSAKES = [
  { phrase: 'a hill to die on', meaning: 'an issue you care enough about to fight over, whatever it costs', example: 'Tabs versus spaces isn’t a hill I’m willing to die on.' },
  { phrase: 'to play devil’s advocate', meaning: 'to argue the opposite side to test an idea, not because you believe it', example: 'Let me play devil’s advocate: what if the data is just noise?' },
  { phrase: 'to move the goalposts', meaning: 'to unfairly change the criteria once they’ve been met', example: 'Every time we hit the target, management moves the goalposts.' },
  { phrase: 'the elephant in the room', meaning: 'the obvious problem everyone avoids mentioning', example: 'Nobody at dinner mentioned the elephant in the room: the divorce.' },
  { phrase: 'to cut corners', meaning: 'to do something cheaply or lazily at the expense of quality', example: 'The contractor cut corners, and the roof leaked within a year.' },
  { phrase: 'a double-edged sword', meaning: 'something with equally real benefits and drawbacks', example: 'Working from home is a double-edged sword — flexible, but isolating.' },
  { phrase: 'to read the room', meaning: 'to sense the mood of the people around you and act accordingly', example: 'He pitched crypto at a funeral — the man cannot read the room.' },
  { phrase: 'to split hairs', meaning: 'to argue about tiny, unimportant differences', example: 'Whether it’s “strategy” or “planning” — now you’re just splitting hairs.' },
  { phrase: 'to beat around the bush', meaning: 'to avoid saying something directly', example: 'Stop beating around the bush — do you want the job or not?' },
  { phrase: 'the tip of the iceberg', meaning: 'the small visible part of a much larger problem', example: 'The refunds we saw were just the tip of the iceberg.' },
  { phrase: 'to bite the bullet', meaning: 'to finally do something unpleasant you’ve been avoiding', example: 'I bit the bullet and booked the dentist appointment.' },
  { phrase: 'to get cold feet', meaning: 'to suddenly lose the nerve to go through with something', example: 'She got cold feet the night before signing the lease.' },
  { phrase: 'a blessing in disguise', meaning: 'something that seems bad but turns out to be good', example: 'Losing that client was a blessing in disguise — it freed us up.' },
  { phrase: 'to throw someone under the bus', meaning: 'to sacrifice or blame someone else to protect yourself', example: 'He threw his own team under the bus in front of the board.' },
  { phrase: 'to burn bridges', meaning: 'to damage a relationship beyond repair, closing off future options', example: 'Quit politely — no point burning bridges in a small industry.' },
  { phrase: 'to keep something at arm’s length', meaning: 'to deliberately avoid becoming too involved or close', example: 'I keep office gossip at arm’s length.' },
  { phrase: 'to take something with a grain of salt', meaning: 'to treat a claim with healthy skepticism', example: 'Take the online reviews with a grain of salt — half are bots.' },
  { phrase: 'to be on the fence', meaning: 'to be undecided between two options', example: 'I’m still on the fence about moving out of the city.' },
  { phrase: 'to talk past each other', meaning: 'to argue without actually addressing each other’s points', example: 'We spent an hour talking past each other about “risk”.' },
  { phrase: 'a slippery slope', meaning: 'a small step likely to lead to worse consequences', example: 'Skipping one workout is a slippery slope back to none.' },
  { phrase: 'to hedge your bets', meaning: 'to protect yourself by not committing to a single option', example: 'She hedged her bets and applied to both programs.' },
  { phrase: 'due diligence', meaning: 'the careful checking you do before a decision or deal', example: 'Do your due diligence before wiring anyone a deposit.' },
  { phrase: 'to pay through the nose', meaning: 'to pay far too much for something', example: 'We paid through the nose for airport coffee.' },
  { phrase: 'to break even', meaning: 'to make neither a profit nor a loss', example: 'The café finally broke even in its second year.' },
  { phrase: 'to cook the books', meaning: 'to falsify financial records', example: 'The CFO had been cooking the books for years.' },
  { phrase: 'a drop in the bucket', meaning: 'an amount far too small to make a difference', example: 'A $100 donation is a drop in the bucket for a hospital wing.' },
  { phrase: 'to tighten your belt', meaning: 'to spend less because money is short', example: 'After the layoffs, everyone tightened their belts.' },
  { phrase: 'to run its course', meaning: 'to develop and end naturally, without intervention', example: 'The doctor said the virus just has to run its course.' },
  { phrase: 'to be under the weather', meaning: 'to feel mildly ill', example: 'I’m a bit under the weather — I’ll skip the gym tonight.' },
  { phrase: 'on the mend', meaning: 'recovering from an illness or setback', example: 'Dad’s on the mend after the surgery.' },
  { phrase: 'to build up a tolerance', meaning: 'to become less responsive to something through repeated exposure', example: 'You build up a tolerance to caffeine embarrassingly fast.' },
  { phrase: 'a clean bill of health', meaning: 'an official confirmation that nothing is wrong', example: 'The checkup gave her a clean bill of health.' },
  { phrase: 'to weigh in on', meaning: 'to add your opinion to a discussion', example: 'The whole team weighed in on the redesign.' },
  { phrase: 'to stand your ground', meaning: 'to refuse to back down under pressure', example: 'She stood her ground when the client demanded a discount.' },
  { phrase: 'to backpedal', meaning: 'to hastily retreat from a position you took', example: 'He backpedaled the moment the numbers were questioned.' },
  { phrase: 'to strike a chord', meaning: 'to resonate emotionally with someone', example: 'That line about missing home struck a chord with me.' },
  { phrase: 'to rub someone the wrong way', meaning: 'to mildly and persistently annoy someone', example: 'His humble-bragging rubs me the wrong way.' },
  { phrase: 'to give someone the benefit of the doubt', meaning: 'to choose to trust someone despite uncertainty', example: 'He’s late again, but let’s give him the benefit of the doubt.' },
  { phrase: 'to jump on the bandwagon', meaning: 'to adopt something only because it’s popular', example: 'Every brand jumped on the AI bandwagon this year.' },
  { phrase: 'to future-proof', meaning: 'to design something so it stays useful as things change', example: 'Learn fundamentals — that’s how you future-proof a career.' },
  { phrase: 'to cut to the chase', meaning: 'to skip the preamble and get to the point', example: 'Let’s cut to the chase: what’s the budget?' },
  { phrase: 'to go down a rabbit hole', meaning: 'to get absorbed in an ever-deeper, often pointless exploration', example: 'I went down a three-hour rabbit hole about mattress reviews.' },
  { phrase: 'the path of least resistance', meaning: 'the easiest option, chosen to avoid effort or conflict', example: 'He always takes the path of least resistance at work.' },
  { phrase: 'to set the bar', meaning: 'to establish the standard others are measured against', example: 'Their customer service sets the bar for the whole industry.' },
  { phrase: 'to raise eyebrows', meaning: 'to cause mild surprise or disapproval', example: 'His expense report raised a few eyebrows.' },
  { phrase: 'to know something inside out', meaning: 'to know something extremely thoroughly', example: 'She knows the tax code inside out.' },
  { phrase: 'to think on your feet', meaning: 'to react and decide quickly under pressure', example: 'Live interviews force you to think on your feet.' },
  { phrase: 'food for thought', meaning: 'something worth thinking carefully about', example: 'Her question about why we even track this gave me food for thought.' },
]

const DAY = 86400000

// Local-midnight day index — the same "which day is it" the rest of the app uses.
export function localDayIndex(date = new Date()) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / DAY)
}

// Deterministic pick for a given day. Stride 7 is co-prime with 48, so
// consecutive days feel unrelated and nothing repeats for 48 days.
export function keepsakeForDay(dayIdx) {
  const i = ((dayIdx * 7) % KEEPSAKES.length + KEEPSAKES.length) % KEEPSAKES.length
  return KEEPSAKES[i]
}

// ── Daily photography — places worth learning English for ────────────────
// Each day carries one world-class landmark photograph (public/places/*,
// sourced from Wikimedia Commons — attribution in public/places/CREDITS.json),
// each labeled with where it was taken. Stride 5 is co-prime with 18, and
// independent of the phrase stride, so the phrase/photo pairing changes daily.
export const PLACES = [
  { file: 'p01.webp', place: 'Positano, Amalfi Coast', country: 'Italy' },
  { file: 'p02.webp', place: 'Oia, Santorini', country: 'Greece' },
  { file: 'p03.webp', place: 'Machu Picchu', country: 'Peru' },
  { file: 'p04.webp', place: 'Kinkaku-ji, Kyoto', country: 'Japan' },
  { file: 'p05.webp', place: 'Göreme, Cappadocia', country: 'Turkey' },
  { file: 'p06.webp', place: 'Hạ Long Bay', country: 'Vietnam' },
  { file: 'p07.webp', place: 'Moraine Lake, Banff', country: 'Canada' },
  { file: 'p08.webp', place: 'Manarola, Cinque Terre', country: 'Italy' },
  { file: 'p09.webp', place: 'Antelope Canyon, Arizona', country: 'United States' },
  { file: 'p10.webp', place: 'The Storr, Isle of Skye', country: 'Scotland' },
  { file: 'p11.webp', place: 'Salar de Uyuni', country: 'Bolivia' },
  { file: 'p12.webp', place: 'Al-Khazneh, Petra', country: 'Jordan' },
  { file: 'p13.webp', place: 'Twelve Apostles, Victoria', country: 'Australia' },
  { file: 'p14.webp', place: 'Zhangjiajie, Hunan', country: 'China' },
  { file: 'p15.webp', place: 'Chefchaouen', country: 'Morocco' },
  { file: 'p16.webp', place: 'Kirkjufell, Snæfellsnes', country: 'Iceland' },
  { file: 'p17.webp', place: 'Taj Mahal, Agra', country: 'India' },
  { file: 'p18.webp', place: 'Bagan', country: 'Myanmar' },
]

export function placeForDay(dayIdx) {
  const n = ((dayIdx * 5) % PLACES.length + PLACES.length) % PLACES.length
  const p = PLACES[n]
  return { ...p, src: `${import.meta.env.BASE_URL}places/${p.file}` }
}

export function photoForDay(dayIdx) {
  return placeForDay(dayIdx).src
}

// Rank titles — quiet prestige for consistency. Thresholds are total active
// (practice) days, not streak, so a broken streak never demotes anyone.
const RANKS = [
  { days: 0, title: 'Newcomer' },
  { days: 3, title: 'Settling In' },
  { days: 7, title: 'Regular' },
  { days: 14, title: 'Committed' },
  { days: 30, title: 'Resident' },
  { days: 60, title: 'Local' },
  { days: 100, title: 'Practically Native' },
]

export function rankFor(activeDays) {
  let current = RANKS[0]
  let next = null
  for (const r of RANKS) {
    if (activeDays >= r.days) current = r
    else { next = r; break }
  }
  return { title: current.title, next: next ? { title: next.title, at: next.days } : null }
}
