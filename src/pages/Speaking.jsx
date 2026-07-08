import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { blobToWavBase64 } from '../lib/audio'
import { pickPrompt } from '../lib/prompts'
import { logSession } from '../lib/db'
import { withUserKey } from '../lib/apiKey'

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function Feedback({ data, onExit }) {
  const errors = data.errors || []
  const vocab = data.vocab || []
  return (
    <div className="speak">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Feedback</span>
      </div>

      {data.transcript && (
        <div className="fb__block">
          <h3 className="fb__h">What we heard</h3>
          <p className="fb__heard">“{data.transcript}”</p>
        </div>
      )}

      {data.overall && <p className="fb__overall">{data.overall}</p>}

      {data.native_example && (
        <div className="fb__block">
          <h3 className="fb__h">A natural way to say it</h3>
          <p className="fb__native">“{data.native_example}”</p>
        </div>
      )}

      <div className="fb__block">
        <h3 className="fb__h">Corrections &amp; refinements <span className="mono">{errors.length}</span></h3>
        {errors.length === 0 && <p className="fb__none">Clean and natural — nothing worth changing this time.</p>}
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

export default function Speaking({ userId, prompt: propPrompt, onExit }) {
  const fallback = useMemo(pickPrompt, [])
  const prompt = propPrompt ?? fallback
  const rec = useAudioRecorder()
  const [start] = useState(() => Date.now())
  const [phase, setPhase] = useState('record') // record | recorded | analyzing | result | error
  const [clip, setClip] = useState(null) // { blob, seconds }
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  async function persist(data) {
    try {
      const errs = (data.errors || []).map((e) => ({
        user_id: userId,
        error_type: e.error_type,
        original: e.original,
        correction: e.correction,
        note: e.note ?? null,
        source_module: 'speaking',
      }))
      if (errs.length) await supabase.from('errors').insert(errs)

      const words = (data.vocab || [])
        .filter((v) => v.word)
        .map((v) => ({
          user_id: userId,
          word: String(v.word).toLowerCase().trim(),
          definition: v.definition ?? null,
          example: v.example ?? null,
          source: 'speaking',
        }))
      if (words.length) {
        await supabase.from('vocabulary').upsert(words, {
          onConflict: 'user_id,word',
          ignoreDuplicates: true,
        })
      }

      const secs = Math.round((Date.now() - start) / 1000)
      await logSession('speaking', secs, userId)
    } catch {
      /* saving is best-effort; don't block the feedback view */
    }
  }

  async function handleStop() {
    const seconds = rec.seconds
    const blob = await rec.stop()
    if (blob && blob.size > 0) {
      setClip({ blob, seconds })
      setPhase('recorded')
    }
  }

  async function analyze() {
    if (!clip) return
    setPhase('analyzing')
    try {
      const audioBase64 = await blobToWavBase64(clip.blob)
      const { data, error } = await supabase.functions.invoke('analyze-speaking', {
        body: withUserKey({ prompt: prompt.text, audioBase64, mimeType: 'audio/wav' }),
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
      setErrMsg(`Couldn’t process the recording: ${e?.message || e}`)
      setPhase('error')
    }
  }

  function reRecord() {
    setClip(null)
    rec.reset()
    setPhase('record')
  }

  if (phase === 'analyzing') {
    return <div className="speak"><p className="review__state">Listening to your English…</p></div>
  }

  if (phase === 'error') {
    return (
      <div className="speak">
        <div className="speak__bar"><button className="review__back" onClick={onExit}>← Today</button></div>
        <div className="review__done">
          <h1>Couldn’t analyze that</h1>
          <p>{errMsg}</p>
          <button className="cta" onClick={reRecord}>Try again</button>
        </div>
      </div>
    )
  }

  if (phase === 'result') return <Feedback data={result} onExit={onExit} />

  // record / recorded phase
  return (
    <div className="speak">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Speaking</span>
      </div>

      <div className="prompt-card">
        <span className="prompt-card__scenario">{prompt.scenario}</span>
        <p className="prompt-card__text">{prompt.text}</p>
        {prompt.focus && <p className="prompt-card__focus">Targets: {prompt.focus}</p>}
      </div>

      {!rec.supported && (
        <p className="speak__hint">
          This browser can’t record audio. Open the site over https in a modern
          browser (Safari or Chrome) and allow the microphone.
        </p>
      )}

      <div className="mic">
        {phase === 'recorded' ? (
          <>
            <span className="mic__done">✓ Recorded {fmt(clip.seconds)}</span>
            <button className="mic__redo" onClick={reRecord}>Re-record</button>
          </>
        ) : (
          <>
            <button
              className={`mic__btn${rec.recording ? ' is-live' : ''}`}
              onClick={() => (rec.recording ? handleStop() : rec.start())}
              disabled={!rec.supported}
            >
              {rec.recording ? '■  Stop' : '●  Record'}
            </button>
            {rec.recording && <span className="mic__live mono">{fmt(rec.seconds)} · recording</span>}
          </>
        )}
      </div>

      {rec.error && <p className="speak__hint">{rec.error}</p>}

      {phase === 'record' && !rec.recording && (
        <p className="speak__interim">
          Speak your answer out loud — 3–4 sentences. Tap Record, talk, then Stop.
        </p>
      )}

      <div className="speak__actions">
        <span />
        <button
          className="cta"
          onClick={analyze}
          disabled={phase !== 'recorded'}
        >
          Analyze my English →
        </button>
      </div>
    </div>
  )
}
