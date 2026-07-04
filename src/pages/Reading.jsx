/*
 * Reading module — the "read" of listen/speak/read/write.
 * A real C1–C2 passage; tap any word for an in-context definition and save it
 * straight to the spaced-review deck. Passage is generated + cached in db.js;
 * taps resolve from the passage glossary first, then a live Gemini lookup.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveTodayReading, lookupWord, saveVocabWord, logSession } from '../lib/db'
import { READING_MINUTES } from '../lib/reading'

// Split into words and the punctuation/space between them, keeping both.
function tokenize(text) {
  return text.match(/[A-Za-z][A-Za-z'’-]*|[^A-Za-z]+/g) || []
}
const isWord = (t) => /^[A-Za-z]/.test(t)
const norm = (w) => w.toLowerCase().replace(/[^a-z]/g, '')

function Paragraph({ text, onTapWord, activeKey, pIndex }) {
  const tokens = useMemo(() => tokenize(text), [text])
  return (
    <p className="read__p">
      {tokens.map((tok, i) => {
        if (!isWord(tok)) return <span key={i}>{tok}</span>
        const key = `${pIndex}:${i}`
        return (
          <button
            key={i}
            className={`rw${activeKey === key ? ' is-active' : ''}`}
            onClick={() => onTapWord(tok, text, key)}
          >
            {tok}
          </button>
        )
      })}
    </p>
  )
}

export default function Reading({ userId, onExit }) {
  const [article, setArticle] = useState(null)
  const [failed, setFailed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [start, setStart] = useState(() => Date.now())
  const [savedCount, setSavedCount] = useState(0)
  const [logged, setLogged] = useState(false)

  // Bottom-sheet lookup state.
  const [sheet, setSheet] = useState(null) // { key, term, loading, data, error, saved }
  const cache = useRef(new Map())          // normalized word -> lookup data (per session)

  const glossary = useMemo(() => {
    const m = new Map()
    for (const g of article?.glossary || []) m.set(norm(g.word), g)
    return m
  }, [article])

  useEffect(() => {
    let alive = true
    resolveTodayReading()
      .then((a) => { if (alive) { setArticle(a); setStart(Date.now()) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const paragraphs = useMemo(
    () => (article?.body || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
    [article],
  )

  async function tapWord(word, context, key) {
    const n = norm(word)
    if (!n) return
    const hit = cache.current.get(n) || glossary.get(n)
    if (hit) {
      setSheet({ key, term: word, loading: false, data: hit, error: null, saved: false })
      return
    }
    setSheet({ key, term: word, loading: true, data: null, error: null, saved: false })
    try {
      const data = await lookupWord(word, context)
      cache.current.set(n, data)
      // Ignore if the user has since tapped a different word.
      setSheet((s) => (s && s.key === key ? { ...s, loading: false, data } : s))
    } catch {
      setSheet((s) => (s && s.key === key ? { ...s, loading: false, error: true } : s))
    }
  }

  async function save() {
    if (!sheet?.data) return
    try {
      await saveVocabWord(userId, {
        word: sheet.data.word || sheet.term,
        definition: sheet.data.definition,
        example: sheet.data.example,
      })
      setSheet((s) => ({ ...s, saved: true }))
      setSavedCount((c) => c + 1)
    } catch {
      setSheet((s) => ({ ...s, error: true }))
    }
  }

  async function readSomethingElse() {
    setRefreshing(true)
    setSheet(null)
    cache.current = new Map()
    try {
      const a = await resolveTodayReading({ force: true })
      setArticle(a)
      setStart(Date.now())
      setSavedCount(0)
      setLogged(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      /* keep the current article on failure */
    } finally {
      setRefreshing(false)
    }
  }

  async function finish() {
    if (!logged) {
      const secs = Math.round((Date.now() - start) / 1000)
      logSession('reading', secs, userId).catch(() => {})
      setLogged(true)
    }
    onExit()
  }

  if (failed) {
    return (
      <div className="reading">
        <div className="speak__bar"><button className="review__back" onClick={onExit}>← Today</button></div>
        <div className="review__done">
          <h1>Couldn’t load a passage</h1>
          <p>Check your connection and try again.</p>
          <button className="cta" onClick={onExit}>Back to today →</button>
        </div>
      </div>
    )
  }

  if (!article) {
    return <div className="reading"><p className="review__state">Finding you something to read…</p></div>
  }

  return (
    <div className={`reading${sheet ? ' has-sheet' : ''}`}>
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Reading</span>
      </div>

      <article className="read">
        <div className="read__eyebrow">{article.source || 'The long read'} · ~{READING_MINUTES} min</div>
        <h1 className="read__title">{article.title}</h1>
        <p className="read__hint">Tap any word to look it up — and keep the ones worth learning.</p>

        <div className="read__body">
          {paragraphs.map((para, i) => (
            <Paragraph
              key={i}
              pIndex={i}
              text={para}
              activeKey={sheet?.key}
              onTapWord={tapWord}
            />
          ))}
        </div>

        <div className="read__foot">
          <button className="read__more" onClick={readSomethingElse} disabled={refreshing}>
            {refreshing ? 'Finding another…' : 'Read something else ↻'}
          </button>
          <span className="read__saved mono">
            {savedCount > 0 ? `${savedCount} word${savedCount > 1 ? 's' : ''} saved` : 'No words saved yet'}
          </span>
        </div>

        <button className="cta" onClick={finish}>
          {savedCount > 0 ? 'Done — save my progress →' : 'Mark as read →'}
        </button>
      </article>

      {sheet && (
        <div className="wsheet" role="dialog" aria-label={`Definition of ${sheet.term}`}>
          <button className="wsheet__close" onClick={() => setSheet(null)} aria-label="Close">×</button>
          <div className="wsheet__head">
            <span className="wsheet__word">{sheet.data?.word || sheet.term}</span>
            {sheet.data?.pos && <span className="wsheet__pos">{sheet.data.pos}</span>}
          </div>

          {sheet.loading && <p className="wsheet__state">Looking it up…</p>}
          {sheet.error && !sheet.data && <p className="wsheet__state">Couldn’t look that up — tap another word.</p>}

          {sheet.data && (
            <>
              <p className="wsheet__def">{sheet.data.definition}</p>
              {sheet.data.example && <p className="wsheet__ex">“{sheet.data.example}”</p>}
              {sheet.saved ? (
                <span className="wsheet__saved">✓ Saved to your review deck</span>
              ) : (
                <button className="wsheet__save" onClick={save}>＋ Save to review</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
