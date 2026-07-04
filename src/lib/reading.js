// Reading passages. Normally a fresh one is Gemini-generated per day and cached
// in localStorage; these bundled passages are the offline / fallback library so
// the reading tab always has something real to show, even if generation fails.
export const READING_MINUTES = 6

export const PASSAGES = [
  {
    title: 'The Quiet Genius of Doing Nothing',
    source: 'Psychology',
    topic: 'idleness and creativity',
    body:
      'We tend to treat idleness as a moral failing — a gap to be plugged with a podcast, a task, a scroll. Yet a growing body of research suggests that the mind does some of its most valuable work precisely when we let it off the leash. Left unoccupied, it does not switch off; it wanders, stitching together loose threads of memory and half-formed ideas.\n\n' +
      'Neuroscientists call the machinery behind this the default mode network, a constellation of brain regions that lights up when we stare out of a train window rather than crunch a spreadsheet. It is thought to underpin daydreaming, self-reflection and the slow, unforced insights that rarely arrive on demand. The catch is that boredom, its usual gateway, has become almost extinct. The moment a queue forms or a lift doors close, a screen materialises to rescue us from the void.\n\n' +
      'The cost of this rescue is subtle but real. In outsourcing every empty minute to our devices, we may be starving the very faculty that lets us make sense of our own lives. The remedy is not grand. A walk without headphones, a few minutes of deliberate staring into space — small acts of resistance that give the wandering mind room to do what it does best.',
    glossary: [
      { word: 'idleness', definition: 'the state of doing nothing; inactivity', example: 'He felt guilty about a whole afternoon of idleness.' },
      { word: 'off the leash', definition: '(figurative) free from restraint or control', example: 'On holiday, her imagination was finally off the leash.' },
      { word: 'constellation', definition: '(figurative) a group of related things considered together', example: 'A constellation of symptoms pointed to the same cause.' },
      { word: 'on demand', definition: 'available or happening whenever requested', example: 'Good ideas rarely come on demand.' },
      { word: 'materialise', definition: 'to appear suddenly, as if from nowhere', example: 'A waiter materialised the instant we sat down.' },
      { word: 'outsource', definition: 'to hand a task over to an outside party instead of doing it yourself', example: 'We outsource our memory to our phones.' },
      { word: 'faculty', definition: 'a natural mental power or ability', example: 'Reading sharpens the faculty of attention.' },
    ],
  },
  {
    title: 'Why Cities Glow at Night',
    source: 'Science',
    topic: 'light pollution',
    body:
      'From space, humanity announces itself as a scatter of light. The great cities blaze; the highways trace thin veins across the dark. It is a strangely beautiful signature — and, increasingly, a troubling one. The glow we cast upward, largely by accident, is reshaping the night for nearly every living thing beneath it.\n\n' +
      'Light pollution is the wasteful spill of artificial light into places it was never meant to reach. Streetlamps that should illuminate a pavement instead bleed into the sky, washing out the stars and confounding creatures that evolved to read the dark. Newly hatched turtles, tuned for millions of years to crawl toward the bright horizon of the sea, now stumble the wrong way toward a car park. Migrating birds, navigating by the heavens, are drawn fatally off course.\n\n' +
      'What makes the problem oddly hopeful is how tractable it is. Unlike carbon in the atmosphere, light leaves no residue; flick the switch and the darkness returns intact. Shielded fixtures, warmer tones and a simple willingness to turn things off can hand the night back almost overnight. Few environmental fixes are so nearly instantaneous — or so quietly restorative.',
    glossary: [
      { word: 'scatter', definition: 'an irregular spread of things over an area', example: 'A scatter of villages dotted the valley.' },
      { word: 'blaze', definition: 'to shine or burn very brightly', example: 'The stadium blazed with floodlights.' },
      { word: 'signature', definition: '(figurative) a distinctive identifying mark or pattern', example: 'Rising heat is a signature of the disease.' },
      { word: 'confound', definition: 'to confuse or bewilder; to thwart', example: 'The new rules confounded even the experts.' },
      { word: 'tractable', definition: 'easy to deal with or solve', example: 'Broken down into steps, the problem became tractable.' },
      { word: 'residue', definition: 'what remains after the main part is gone', example: 'The scandal left a residue of distrust.' },
      { word: 'restorative', definition: 'having the power to renew or bring back health', example: 'A quiet weekend can be deeply restorative.' },
    ],
  },
]

// Same passage for the whole calendar day, rotating day to day (fallback only).
export function pickPassage() {
  const day = Math.floor(Date.now() / 86400000)
  return PASSAGES[day % PASSAGES.length]
}
