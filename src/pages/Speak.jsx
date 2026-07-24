/*
 * Live Session — the conversation happens in ChatGPT/Gemini voice mode (the
 * only zero-cost way to get native-speed spontaneous speech), driven by
 * today's coach prompt. The learning comes home the reliable way: the learner
 * pastes the WHOLE transcript back here and the debrief-talk edge function
 * (a strong text model, not the lazy voice model) writes the real coaching
 * report — every upgrade with the why, the register, and a range example.
 * Banking sends expressions to the review deck and corrections to the
 * weak-spots log that tunes tomorrow's prompt. If the AI debrief is
 * unavailable, the old "=== LINGOLOOP NOTES ===" parser is the fallback.
 */
import { useEffect, useState } from 'react'
import { debriefSession, getTalkFuel, logSession, saveDebrief, saveSessionNotes } from '../lib/db'
import { buildTalkPrompt, buildTranscriptPrompt, parseNotes, SESSION_MINUTES } from '../lib/talk'
import { localDayIndex, placeForDay } from '../lib/keepsakes'
import { needsOwnKey } from '../lib/apiKey'

export default function Speak({ userId, email, onExit }) {
  const [built, setBuilt] = useState(null)
  const [copied, setCopied] = useState('') // '' | 'prompt' | 'transcript'
  const [pasteText, setPasteText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [debrief, setDebrief] = useState(null) // AI debrief result
  const [fallback, setFallback] = useState(null) // parseNotes() result when AI is unavailable
  const [statusMsg, setStatusMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // { words, corrections } | 'plain'
  const [saveErr, setSaveErr] = useState('')

  const needsKey = needsOwnKey(email)

  useEffect(() => {
    let alive = true
    // Personalize with live data; if the fetch fails, the prompt still works
    // with its generic fallbacks — never block the feature on the network.
    getTalkFuel()
      .then((fuel) => { if (alive) setBuilt(buildTalkPrompt(fuel)) })
      .catch(() => { if (alive) setBuilt(buildTalkPrompt()) })
    return () => { alive = false }
  }, [])

  async function copy(which, textToCopy, elId) {
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(which)
      setTimeout(() => setCopied((c) => (c === which ? '' : c)), 2200)
    } catch {
      // Clipboard API can be blocked (older iOS in-app views): fall back to
      // selecting the text so a long-press copy works.
      const el = document.getElementById(elId)
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }

  async function analyze() {
    if (!pasteText.trim() || analyzing) return
    setAnalyzing(true)
    setStatusMsg('')
    setDebrief(null)
    setFallback(null)
    try {
      const d = await debriefSession({
        transcript: pasteText,
        sessionTitle: built?.seed?.title,
        personaName: built?.persona?.name,
      })
      const found = (d.upgrades?.length ?? 0) + (d.new_expressions?.length ?? 0)
      if (found === 0) {
        setStatusMsg(d.overall || 'The coach couldn’t find a conversation in that paste — make sure it includes your side of the chat.')
      } else {
        setDebrief(d)
      }
    } catch {
      // AI debrief unreachable (offline, quota, key) — the old notes-block
      // parser still rescues pastes that contain one.
      const parsed = parseNotes(pasteText)
      if (parsed.expressions.length > 0) {
        setFallback(parsed)
        setStatusMsg('Couldn’t reach the AI coach, but a notes block was found in your paste — banking from that instead.')
      } else {
        setStatusMsg('Couldn’t reach the AI coach — check your connection and try again. You can still log the session below.')
      }
    } finally {
      setAnalyzing(false)
    }
  }

  async function finish() {
    setBusy(true)
    setSaveErr('')
    try {
      let saved = null
      if (debrief) saved = await saveDebrief(userId, debrief)
      else if (fallback) saved = await saveSessionNotes(userId, fallback)
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
  const transcriptText = buildTranscriptPrompt().text
  const spot = placeForDay(localDayIndex() + 9)
  const bankCount = debrief
    ? (debrief.upgrades?.length ?? 0) + (debrief.new_expressions?.length ?? 0)
    : (fallback?.expressions.length ?? 0)

  if (done) {
    const banked = done !== 'plain'
    return (
      <div className="speak">
        <div className="speak__bar">
          <button className="review__back" onClick={onExit}>← Today</button>
          <span className="review__progress mono">Live Session</span>
        </div>
        <div className="review__done">
          <h1>{banked ? 'Debrief banked.' : 'Session logged.'}</h1>
          <p>
            {banked
              ? <><b>{done.words}</b> expression{done.words === 1 ? '' : 's'} went into your review deck — each with the why, the register, and an example — and <b>{done.corrections}</b> coaching point{done.corrections === 1 ? '' : 's'} joined your weak spots. Tomorrow’s coach will listen for them.</>
              : 'A real conversation is the closest thing to living in the language. Next time, paste the transcript too — the debrief turns it into review cards automatically.'}
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

      <div className="plate" style={{ backgroundImage: `url(${spot.src})` }}>
        <span className="plate__cap">{seed.kind === 'scene' ? 'Today’s scene' : 'Today’s conversation'}</span>
        <span className="plate__cap plate__cap--loc">✦ {spot.place} — {spot.country}</span>
      </div>

      <header className="talk__intro">
        <div className="hero__eyebrow">Your partner &amp; coach</div>
        <h1 className="talk__title">{persona.name}, {persona.who}.</h1>
        <p className="talk__topic"><b>{seed.title}</b> — {seed.hook} Corrections come slowly, twice, and you say them back — then the chat flows on.</p>
      </header>

      <ol className="talk__steps">
        <li><b>Copy prompt 1</b> below.</li>
        <li>Open <a href="https://chatgpt.com" target="_blank" rel="noreferrer">ChatGPT</a> or <a href="https://gemini.google.com" target="_blank" rel="noreferrer">Gemini</a>, start <b>voice mode</b>, and paste it as your first message.</li>
        <li>Talk for ~{SESSION_MINUTES} minutes. Say <b>“wrap up”</b> when you’re ready to end.</li>
        <li>Leave voice mode. Back in the text box, <b>paste prompt 2</b> — it makes the AI print your whole conversation word for word.</li>
        <li>Copy the transcript it prints, and <b>paste it below</b>. Your coach here reads it and writes the real debrief.</li>
      </ol>

      <div className="talk__promptwrap">
        <div className="talk__prompthead">
          <span className="arc-card__label">Prompt 1 · start the session · tuned to your weak spots</span>
          <button className={`talk__copy${copied === 'prompt' ? ' is-copied' : ''}`} onClick={() => copy('prompt', text, 'talk-prompt-text')}>
            {copied === 'prompt' ? '✓ Copied' : 'Copy prompt'}
          </button>
        </div>
        <pre id="talk-prompt-text" className="talk__prompt">{text}</pre>
      </div>

      <div className="talk__promptwrap talk__promptwrap--transcript">
        <div className="talk__prompthead">
          <span className="arc-card__label">Prompt 2 · after you finish · get the transcript</span>
          <button className={`talk__copy${copied === 'transcript' ? ' is-copied' : ''}`} onClick={() => copy('transcript', transcriptText, 'talk-transcript-text')}>
            {copied === 'transcript' ? '✓ Copied' : 'Copy prompt'}
          </button>
        </div>
        <pre id="talk-transcript-text" className="talk__prompt">{transcriptText}</pre>
      </div>

      <section className="bank">
        <div className="bank__label">After the conversation — get your debrief</div>
        <textarea
          className="bank__paste"
          value={pasteText}
          onChange={(e) => { setPasteText(e.target.value); setDebrief(null); setFallback(null); setStatusMsg('') }}
          placeholder="Paste the whole conversation here — everything from the chat screen. Rough copies are fine; your coach sorts it out."
        />

        {needsKey && (
          <p className="bank__status mono is-miss">
            The debrief is AI-powered, so this account needs its own free Gemini key — add it in Settings. You can still log the session below.
          </p>
        )}

        {statusMsg && <p className={`bank__status mono ${fallback ? 'is-found' : 'is-miss'}`}>{statusMsg}</p>}

        {!debrief && !fallback && (
          <div className="speak__actions">
            <button className="talk__skip" onClick={finish} disabled={busy}>
              Skip — just log the session →
            </button>
            <button className="cta" onClick={analyze} disabled={analyzing || !pasteText.trim() || needsKey}>
              {analyzing ? 'Your coach is reading…' : 'Get my debrief →'}
            </button>
          </div>
        )}

        {debrief && (
          <div className="debrief">
            {debrief.overall && (
              <blockquote className="debrief__overall">
                <span className="debrief__kicker mono">The one thing</span>
                {debrief.overall}
              </blockquote>
            )}

            {(debrief.strengths?.length ?? 0) > 0 && (
              <div className="debrief__section">
                <h2 className="debrief__head mono">What landed</h2>
                {debrief.strengths.map((s, i) => (
                  <p className="debrief__strength" key={i}>✓ {s}</p>
                ))}
              </div>
            )}

            {(debrief.upgrades?.length ?? 0) > 0 && (
              <div className="debrief__section">
                <h2 className="debrief__head mono">Your upgrades · {debrief.upgrades.length}</h2>
                <div className="bank__cards">
                  {debrief.upgrades.map((u, i) => (
                    <article className="bankx bankx--upgrade" key={i}>
                      <p className="bankx__said">you said · <i>“{u.you_said}”</i></p>
                      <h3 className="bankx__phrase">“{u.native}”</h3>
                      {u.why && <p className="bankx__meta">{u.why}</p>}
                      {u.use_when && <p className="bankx__use">Use it: {u.use_when}</p>}
                      {u.example && <p className="bankx__use">— {u.example}</p>}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {(debrief.new_expressions?.length ?? 0) > 0 && (
              <div className="debrief__section">
                <h2 className="debrief__head mono">Worth stealing</h2>
                <div className="bank__cards">
                  {debrief.new_expressions.map((x, i) => (
                    <article className="bankx" key={i}>
                      <h3 className="bankx__phrase">“{x.phrase}”</h3>
                      {x.meaning && <p className="bankx__meta">{x.meaning}</p>}
                      {x.use_when && <p className="bankx__use">Use it: {x.use_when}</p>}
                      {x.example && <p className="bankx__use">— {x.example}</p>}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {((debrief.pronunciation?.length ?? 0) > 0 || debrief.fluency) && (
              <div className="debrief__section">
                <h2 className="debrief__head mono">Sound &amp; flow</h2>
                <div className="bank__cards">
                  {(debrief.pronunciation ?? []).map((p, i) => (
                    <article className="bankx bankx--pron" key={i}>
                      <h3 className="bankx__phrase">{p.word}</h3>
                      <p className="bankx__meta">{p.tip}</p>
                    </article>
                  ))}
                  {debrief.fluency && (
                    <article className="bankx bankx--pron">
                      <p className="bankx__meta"><b>Fluency focus:</b> {debrief.fluency}</p>
                    </article>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {fallback && (
          <div className="bank__cards">
            {fallback.expressions.map((x, i) => (
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
          </div>
        )}

        {saveErr && <p className="bank__status mono is-miss">{saveErr}</p>}

        {(debrief || fallback) && (
          <div className="speak__actions">
            <span />
            <button className="cta" onClick={finish} disabled={busy}>
              {`Bank ${bankCount} & finish →`}
            </button>
          </div>
        )}
      </section>

      <p className="note">
        A new partner and session every day — and every banked upgrade makes
        tomorrow’s coach smarter about you.
      </p>
    </div>
  )
}
