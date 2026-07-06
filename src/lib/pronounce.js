/*
 * Zero-cost, offline text-to-speech via the browser's Web Speech API.
 * No network call, no API key, no quota — it uses the voices already on the
 * device. Falls back silently on browsers without speech synthesis.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

// Whether the current browser can speak at all (used to hide the button if not).
export const canSpeak = !!synth

// Voices load asynchronously on some browsers, so cache the best English one
// and refresh it when the list becomes available.
let cachedVoice = null
function pickVoice() {
  if (!synth) return null
  const voices = synth.getVoices()
  if (!voices.length) return null
  return (
    // Prefer a natural-sounding US English voice…
    voices.find((v) => /en[-_]US/i.test(v.lang) && /natural|google|samantha|premium/i.test(v.name)) ||
    voices.find((v) => /en[-_]US/i.test(v.lang)) ||
    // …then any English voice, then whatever exists.
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0]
  )
}

if (synth) {
  cachedVoice = pickVoice()
  // Chrome populates voices lazily; recache when it fires.
  try {
    synth.addEventListener('voiceschanged', () => { cachedVoice = pickVoice() })
  } catch {
    /* older browsers: getVoices() is already populated */
  }
}

/**
 * Speak a word or phrase aloud in English. Cancels anything mid-utterance so
 * rapid taps don't queue up.
 */
export function speak(text) {
  if (!synth || !text) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(String(text))
  u.lang = 'en-US'
  u.rate = 0.95 // a touch slower than default — clearer for a single word
  const v = cachedVoice || pickVoice()
  if (v) u.voice = v
  synth.speak(u)
}
