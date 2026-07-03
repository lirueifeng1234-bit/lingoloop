import { useEffect, useState } from 'react'
import { getDueCards, reviewCard, logSession } from '../lib/db'
import { RATINGS } from '../lib/fsrs'

export default function Review({ userId, onExit }) {
  const [cards, setCards] = useState(null) // null = loading
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [start] = useState(() => Date.now())
  const [logged, setLogged] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getDueCards().then(setCards).catch(() => setCards([]))
  }, [])

  const total = cards?.length ?? 0
  const done = cards !== null && idx >= total

  // Log the session once, when we finish a non-empty review.
  useEffect(() => {
    if (done && total > 0 && !logged) {
      setLogged(true)
      const secs = Math.round((Date.now() - start) / 1000)
      logSession('vocab', secs, userId).catch(() => {})
    }
  }, [done, total, logged, start, userId])

  async function rate(rating) {
    if (busy) return
    setBusy(true)
    try {
      await reviewCard(cards[idx], rating)
    } catch {
      /* keep going even if a write hiccups */
    }
    setBusy(false)
    setRevealed(false)
    setIdx((i) => i + 1)
  }

  if (cards === null) {
    return (
      <div className="review">
        <p className="review__state">Loading your cards…</p>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="review">
        <div className="review__done">
          <h1>All caught up</h1>
          <p>Nothing is due right now. New words arrive as you speak and read.</p>
          <button className="cta" onClick={onExit}>Back to today →</button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="review">
        <div className="review__done">
          <h1>Nice — {total} reviewed</h1>
          <p>Each card is rescheduled by FSRS for the best moment to see it again.</p>
          <button className="cta" onClick={onExit}>Back to today →</button>
        </div>
      </div>
    )
  }

  const card = cards[idx]

  return (
    <div className="review">
      <div className="review__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">{idx + 1} / {total}</span>
      </div>
      <div className="review__meter"><i style={{ width: `${(idx / total) * 100}%` }} /></div>

      <div className="card">
        <div className="card__word">{card.word}</div>
        {!revealed && <div className="card__prompt">Do you remember it?</div>}
        {revealed && (
          <div className="card__answer">
            <p className="card__def">{card.definition}</p>
            {card.example && <p className="card__ex">“{card.example}”</p>}
          </div>
        )}
      </div>

      {!revealed ? (
        <button className="cta review__reveal" onClick={() => setRevealed(true)}>
          Show answer
        </button>
      ) : (
        <div className="rate-grid">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              className={`rate rate--${r.variant}`}
              disabled={busy}
              onClick={() => rate(r.key)}
            >
              <b>{r.label}</b>
              <span>{r.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
