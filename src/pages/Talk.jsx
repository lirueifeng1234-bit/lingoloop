/*
 * Live Talk — the bridge to a real-feeling conversation. LingoLoop can't do
 * live native-speed voice on a zero budget, but ChatGPT/Gemini voice modes
 * can — they're just sycophantic and generic out of the box. So this page
 * hands you today's antidote: a copy-ready prompt with a rotating opinionated
 * persona, anti-agreement rules, and your actual weak spots and due words
 * baked in. Logging the talk counts toward your streak like any session.
 */
import { useEffect, useState } from 'react'
import { getTalkFuel, logSession } from '../lib/db'
import { buildTalkPrompt, TALK_MINUTES } from '../lib/talk'

export default function Talk({ userId, onExit }) {
  const [built, setBuilt] = useState(null)
  const [copied, setCopied] = useState(false)
  const [logged, setLogged] = useState(false)
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    let alive = true
    // Personalize with live data; if the fetch fails, the prompt still works
    // with its generic fallbacks — never block the feature on the network.
    getTalkFuel()
      .then((fuel) => { if (alive) setBuilt(buildTalkPrompt(fuel)) })
      .catch(() => { if (alive) setBuilt(buildTalkPrompt()) })
    return () => { alive = false }
  }, [])

  async function copy() {
    if (!built) return
    try {
      await navigator.clipboard.writeText(built.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Clipboard API can be blocked (older iOS in-app views): fall back to
      // selecting the text so a long-press copy works.
      const el = document.getElementById('talk-prompt-text')
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }

  async function logTalk() {
    setLogging(true)
    try {
      await logSession('talk', TALK_MINUTES * 60, userId)
      setLogged(true)
    } catch {
      setLogging(false)
    }
  }

  if (!built) {
    return <div className="speak"><p className="review__state">Preparing today’s conversation…</p></div>
  }

  const { persona, seed, text } = built

  if (logged) {
    return (
      <div className="speak">
        <div className="speak__bar">
          <button className="review__back" onClick={onExit}>← Today</button>
          <span className="review__progress mono">Live Talk</span>
        </div>
        <div className="review__done">
          <h1>Talk logged. 🔥 kept alive.</h1>
          <p>
            Nice — a real conversation is the closest thing to living in the
            language. If {persona.name} gave you a debrief, feed the corrections
            into tomorrow’s speaking and writing.
          </p>
          <button className="cta" onClick={onExit}>Back to today →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="speak">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Live Talk</span>
      </div>

      <header className="talk__intro">
        <div className="hero__eyebrow">Tonight’s conversation partner</div>
        <h1 className="talk__title">{persona.name}, {persona.who}.</h1>
        <p className="talk__topic"><b>{seed.topic}</b> — {seed.angle}</p>
      </header>

      <ol className="talk__steps">
        <li><b>Copy</b> the prompt below.</li>
        <li>Open <a href="https://chatgpt.com" target="_blank" rel="noreferrer">ChatGPT</a> or <a href="https://gemini.google.com" target="_blank" rel="noreferrer">Gemini</a>, start <b>voice mode</b>, and paste (or read) it as your first message.</li>
        <li>Talk for ~{TALK_MINUTES} minutes. Say “wrap up” to get your debrief.</li>
        <li>Come back and log it — it counts toward your streak.</li>
      </ol>

      <div className="talk__promptwrap">
        <div className="talk__prompthead">
          <span className="arc-card__label">Today’s prompt · tuned to your weak spots</span>
          <button className={`talk__copy${copied ? ' is-copied' : ''}`} onClick={copy}>
            {copied ? '✓ Copied' : 'Copy prompt'}
          </button>
        </div>
        <pre id="talk-prompt-text" className="talk__prompt">{text}</pre>
      </div>

      <div className="speak__actions">
        <span />
        <button className="cta" onClick={logTalk} disabled={logging}>
          I had the conversation →
        </button>
      </div>

      <p className="note">
        A new partner, topic, and stance every day — and the prompt always
        carries your latest corrections and due words.
      </p>
    </div>
  )
}
