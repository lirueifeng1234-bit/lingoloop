import { speak, canSpeak } from '../lib/pronounce'

/*
 * A small speaker button that reads a word or phrase aloud.
 * Free, offline, on-device (Web Speech API). Renders nothing on browsers
 * without speech synthesis, so callers don't need to guard.
 */
export default function SayButton({ text, size = 'md' }) {
  if (!canSpeak || !text) return null
  return (
    <button
      type="button"
      className={`say say--${size}`}
      onClick={(e) => { e.stopPropagation(); speak(text) }}
      aria-label={`Hear "${text}" pronounced`}
      title="Hear it"
    >
      <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor" stroke="none" />
        <path d="M16 9a4 4 0 0 1 0 6" />
        <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      </svg>
    </button>
  )
}
