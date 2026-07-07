/*
 * Writing module — the "write" of listen/speak/read/write.
 * A real written task (email, review, argument…); the learner drafts a short
 * piece and gets native-level editorial feedback. Mirrors Speaking, but judged
 * as writing: register, cohesion, structure. Errors + vocab flow into review.
 */
import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pickWritingPrompt } from '../lib/writing'
import { logSession } from '../lib/db'

const MIN_WORDS = 25

function countWords(s) {
  const m = s.trim().match(/\S+/g)
  return m ? m.length : 0
}

function Feedback({ draft, data, onExit }) {
  const errors = data.errors || []
  const vocab = data.vocab || []
  return (
    <div className="speak">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Feedback</span>
      </div>

      {draft && (
        <div className="fb__block">
          <h3 className="fb__h">Your draft</h3>
          <p className="fb__heard">{draft}</p>
        </div>
      )}

      {data.overall && <p className="fb__overall">{data.overall}</p>}

      {data.native_example && (
        <div className="fb__block">
          <h3 className="fb__h">How a native writer would put it</h3>
          <p className="fb__native">{data.native_example}</p>
        </div>
      )}

      <div className="fb__block">
        <h3 className="fb__h">Corrections &amp; refinements <span className="mono">{errors.length}</span></h3>
        {errors.length === 0 && <p className="fb__none">Clean and well-made — nothing worth changing this time.</p>}
        {errors.map((e, i) => (
          <div className="corr" key={i}>
            <span className="corr__type">{e.error_type}</span>
            <p className="corr__line">
              <span className="corr__old">{e.original}</span>
              <span className="corr__arrow"> → </span>
              <span className="corr__new">{e.correction}</span>
            </p>
            {e.note && <p className="corr__note">{e.note}</p>}
          </div>
        ))}
      </div>

      {vocab.length > 0 && (
        <div className="fb__block">
          <h3 className="fb__h">Words &amp; expressions to learn <span className="mono">{vocab.length}</span></h3>
          <p className="fb__sub">Saved to your review deck — these come back when they’re due.</p>
          {vocab.map((v, i) => (
            <div className="vocab-add" key={i}>
              <p className="vocab-add__head"><b>{v.word}</b> — {v.definition}</p>
              {v.example && <p className="vocab-add__ex">“{v.example}”</p>}
            </div>
          ))}
        </div>
      )}

      <button className="cta" onClick={onExit}>Back to today →</button>
    </div>
  )
}

export default function Writing({ userId, onExit }) {
  const prompt = useMemo(pickWritingPrompt, [])
  const [start] = useState(() => Date.now())
  const [text, setText] = useState('')
  const [phase, setPhase] = useState('write') // write | analyzing | result | error
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const words = countWords(text)
  const ready = words >= MIN_WORDS

  async function persist(data) {
    try {
      const errs = (data.errors || []).map((e) => ({
        user_id: userId,
        error_type: e.error_type,
        original: e.original,
        correction: e.correction,
        note: e.note ?? null,
        source_module: 'writing',
      }))
      if (errs.length) await supabase.from('errors').insert(errs)

      const vocabRows = (data.vocab || [])
        .filter((v) => v.word)
        .map((v) => ({
          user_id: userId,
          word: String(v.word).toLowerCase().trim(),
          definition: v.definition ?? null,
          example: v.example ?? null,
          source: 'writing',
        }))
      if (vocabRows.length) {
        await supabase.from('vocabulary').upsert(vocabRows, {
          onConflict: 'user_id,word',
          ignoreDuplicates: true,
        })
      }

      const secs = Math.round((Date.now() - start) / 1000)
      await logSession('writing', secs, userId)
    } catch {
      /* saving is best-effort; don't block the feedback view */
    }
  }

  async function analyze() {
    if (!ready) return
    setPhase('analyzing')
    try {
      const { data, error } = await supabase.functions.invoke('analyze-writing', {
        body: { prompt: prompt.text, text },
      })

      if (error || data?.error) {
        setErrMsg(
          data?.detail || data?.error
            ? `Gemini said: ${data.detail || data.error}`
            : 'The analysis service isn’t reachable right now. Please try again in a moment.',
        )
        setPhase('error')
        return
      }

      setResult(data)
      setPhase('result')
      persist(data)
    } catch (e) {
      setErrMsg(`Couldn’t analyze that: ${e?.message || e}`)
      setPhase('error')
    }
  }

  if (phase === 'analyzing') {
    return <div className="speak"><p className="review__state">Reading your writing closely…</p></div>
  }

  if (phase === 'error') {
    return (
      <div className="speak">
        <div className="speak__bar"><button className="review__back" onClick={onExit}>← Today</button></div>
        <div className="review__done">
          <h1>Couldn’t analyze that</h1>
          <p>{errMsg}</p>
          <button className="cta" onClick={() => setPhase('write')}>Back to your draft</button>
        </div>
      </div>
    )
  }

  if (phase === 'result') return <Feedback draft={text} data={result} onExit={onExit} />

  // write phase
  return (
    <div className="speak">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Writing</span>
      </div>

      <div className="prompt-card">
        <span className="prompt-card__scenario">{prompt.scenario}</span>
        <p className="prompt-card__text">{prompt.text}</p>
        {prompt.focus && <p className="prompt-card__focus">Targets: {prompt.focus}</p>}
      </div>

      <textarea
        className="wbox"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your draft here. Aim for a short, finished piece — five or six real sentences."
        autoFocus
        spellCheck="true"
      />

      <div className="wbar">
        <span className={`wcount mono${ready ? ' is-ready' : ''}`}>
          {words} {words === 1 ? 'word' : 'words'}
          {!ready && ` · ${MIN_WORDS - words} more to analyze`}
        </span>
        <button className="cta" onClick={analyze} disabled={!ready}>
          Get my feedback →
        </button>
      </div>
    </div>
  )
}
