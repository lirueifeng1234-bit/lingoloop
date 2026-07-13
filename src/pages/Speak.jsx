/*
 * Live Session — Speaking and Live Talk, merged into one flow.
 * The conversation itself happens in ChatGPT/Gemini voice mode (the only
 * zero-cost way to get native-speed spontaneous speech), driven by today's
 * coach prompt. The learning comes home: the AI ends by writing structured
 * session notes, which get pasted back here, parsed, and banked — every
 * expression (with meaning, usage guidance, and context) into the review
 * deck, every correction into the weak-spots log that tunes tomorrow's
 * prompt. No key needed anywhere in this flow.
 */
import { useEffect, useMemo, useState } from 'react'
import { getTalkFuel, logSession, saveSessionNotes } from '../lib/db'
import { buildTalkPrompt, parseNotes, SESSION_MINUTES } from '../lib/talk'
import { localDayIndex, photoForDay } from '../lib/keepsakes'

export default function Speak({ userId, onExit }) {
  const [built, setBuilt] = useState(null)
  const [copied, setCopied] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // { words, corrections } | 'plain'
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    let alive = true
    // Personalize with live data; if the fetch fails, the prompt still works
    // with its generic fallbacks — never block the feature on the network.
    getTalkFuel()
      .then((fuel) => { if (alive) setBuilt(buildTalkPrompt(fuel)) })
      .catch(() => { if (alive) setBuilt(buildTalkPrompt()) })
    return () => { alive = false }
  }, [])

  const parsed = useMemo(() => parseNotes(notesText), [notesText])
  const found = parsed.expressions.length

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

  async function finish() {
    setBusy(true)
    setSaveErr('')
    try {
      const saved = found ? await saveSessionNotes(userId, parsed) : null
      await logSession('speaking', SESSION_MINUTES * 60, userId)
      setDone(saved ?? 'plain')
    } catch {
      setSaveErr('Couldn’t save — check your connection and try again.')
      setBusy(false)
    }
  }

  if (!built) {
    return <div className="speak"><p className="review__state">Preparing today’s session…</p></div>
  }

  const { persona, seed, text } = built

  if (done) {
    const banked = done !== 'plain'
    return (
      <div className="speak">
        <div className="speak__bar">
          <button className="review__back" onClick={onExit}>← Today</button>
          <span className="review__progress mono">Live Session</span>
        </div>
        <div className="review__done">
          <h1>{banked ? 'Session banked.' : 'Session logged.'}</h1>
          <p>
            {banked
              ? <><b>{done.words}</b> expression{done.words === 1 ? '' : 's'} went into your review deck with full context, and <b>{done.corrections}</b> coaching point{done.corrections === 1 ? '' : 's'} joined your weak spots — tomorrow’s session will listen for them.</>
              : 'A real conversation is the closest thing to living in the language. Next time, paste the session notes too — they become review cards automatically.'}
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
        <span className="review__progress mono">Live Session</span>
      </div>

      <div
        className="plate"
        style={{ backgroundImage: `url(${photoForDay(localDayIndex() + 9)})` }}
        aria-hidden="true"
      >
        <span className="plate__cap">{seed.kind === 'scene' ? 'Today’s scene' : 'Today’s conversation'} · {seed.title}</span>
      </div>

      <header className="talk__intro">
        <div className="hero__eyebrow">Your partner &amp; coach</div>
        <h1 className="talk__title">{persona.name}, {persona.who}.</h1>
        <p className="talk__topic"><b>{seed.title}</b> — {seed.hook} Corrections come slowly, twice, and you say them back — then the chat flows on.</p>
      </header>

      <ol className="talk__steps">
        <li><b>Copy</b> the prompt below.</li>
        <li>Open <a href="https://chatgpt.com" target="_blank" rel="noreferrer">ChatGPT</a> or <a href="https://gemini.google.com" target="_blank" rel="noreferrer">Gemini</a>, start <b>voice mode</b>, and paste it as your first message.</li>
        <li>Talk for ~{SESSION_MINUTES} minutes. Say <b>“wrap up”</b> when you’re ready to end.</li>
        <li>The coach writes your <b>session notes</b> into the chat — copy them.</li>
        <li>Paste them below to bank everything into your review deck.</li>
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

      <section className="bank">
        <div className="bank__label">After the conversation — bank your notes</div>
        <textarea
          className="bank__paste"
          value={notesText}
          onChange={(e) => setNotesText(e.target.value)}
          placeholder="Paste your session notes here — anything from “=== LINGOLOOP NOTES ===” to “=== END ===”. Pasting the whole chat transcript works too."
        />
        {notesText.trim() && (
          <p className={`bank__status mono ${found ? 'is-found' : 'is-miss'}`}>
            {found
              ? <>✓ Found {found} expression{found === 1 ? '' : 's'}{parsed.pronunciation.length > 0 && <> · {parsed.pronunciation.length} pronunciation note{parsed.pronunciation.length === 1 ? '' : 's'}</>}{parsed.fluency.length > 0 && <> · fluency focus</>}</>
              : 'No notes found in that paste — make sure it includes the block the coach wrote. You can still log the session below.'}
          </p>
        )}

        {found > 0 && (
          <div className="bank__cards">
            {parsed.expressions.map((x, i) => (
              <article className="bankx" key={i}>
                <h3 className="bankx__phrase">“{x.phrase}”</h3>
                {(x.meaning || x.youSaid) && (
                  <p className="bankx__meta">
                    {x.meaning}
                    {x.youSaid && !/^new$/i.test(x.youSaid) && <> · you said: <i>“{x.youSaid}”</i></>}
                  </p>
                )}
                {x.useIt && <p className="bankx__use">Use it: {x.useIt}</p>}
                {x.example && <p className="bankx__use">— {x.example}</p>}
              </article>
            ))}
            {parsed.pronunciation.map((p, i) => (
              <article className="bankx bankx--pron" key={`p${i}`}>
                <h3 className="bankx__phrase">{p.word}</h3>
                <p className="bankx__meta">Pronunciation: {p.tip}</p>
              </article>
            ))}
            {parsed.fluency.map((f, i) => (
              <article className="bankx bankx--pron" key={`f${i}`}>
                <p className="bankx__meta">Fluency focus: {f}</p>
              </article>
            ))}
          </div>
        )}

        {saveErr && <p className="bank__status mono is-miss">{saveErr}</p>}

        <div className="speak__actions">
          <span />
          <button className="cta" onClick={finish} disabled={busy}>
            {found ? `Bank ${found} & finish →` : 'I had the conversation →'}
          </button>
        </div>
      </section>

      <p className="note">
        A new partner and session every day — and every banked expression makes
        tomorrow’s coach smarter about you.
      </p>
    </div>
  )
}
