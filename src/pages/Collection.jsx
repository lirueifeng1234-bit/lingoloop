/*
 * The Collection — the daily-return hook. Each calendar day carries one
 * C1–C2 expression (deterministic); finishing today's full loop unseals
 * today's card, and every past practice day already owns its card. All
 * derived from practice_sessions + getTodayProgress — no new tables.
 */
import { useEffect, useState } from 'react'
import { getActiveDays, getTodayProgress } from '../lib/db'
import { keepsakeForDay, localDayIndex, photoForDay, rankFor } from '../lib/keepsakes'

const fmtDay = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Each card opens on its day's photograph — the daily-changing luxury moment —
// with the expression set on ivory below, like a plate in a fine print series.
function KeepsakeCard({ k, idx, date, isToday }) {
  return (
    <article className={`kcard${isToday ? ' kcard--today' : ''}`}>
      <div className="kcard__photo" style={{ backgroundImage: `url(${photoForDay(idx)})` }} aria-hidden="true" />
      <div className="kcard__body">
        <div className="kcard__date mono">{isToday ? 'Today' : fmtDay(date)}</div>
        <h3 className="kcard__phrase">“{k.phrase}”</h3>
        <p className="kcard__meaning">{k.meaning}</p>
        <p className="kcard__example">{k.example}</p>
      </div>
    </article>
  )
}

export default function Collection({ onExit }) {
  const [state, setState] = useState(null) // { days, progress } | 'error'

  useEffect(() => {
    let alive = true
    Promise.all([getActiveDays(), getTodayProgress()])
      .then(([days, progress]) => { if (alive) setState({ days, progress }) })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [])

  if (state === 'error') {
    return (
      <div className="dash">
        <div className="speak__bar"><button className="review__back" onClick={onExit}>← Today</button></div>
        <div className="review__done">
          <h1>Couldn’t open your collection</h1>
          <p>Check your connection and try again.</p>
          <button className="cta" onClick={onExit}>Back to today →</button>
        </div>
      </div>
    )
  }
  if (!state) {
    return <div className="dash"><p className="review__state">Opening your collection…</p></div>
  }

  const { days, progress } = state
  const todayIdx = localDayIndex()
  const core = ['speaking', 'reading', 'writing', 'vocab']
  const loopDone = core.every((k) => progress[k])
  const todayKeepsake = keepsakeForDay(todayIdx)

  // Past cards: every previous active day owns its keepsake. Today's card is
  // handled separately — it needs the full loop, not just any session.
  const past = days
    .map((d) => ({ date: d, idx: localDayIndex(d) }))
    .filter((x) => x.idx < todayIdx)
    .sort((a, b) => b.idx - a.idx)

  const owned = past.length + (loopDone ? 1 : 0)
  const rank = rankFor(days.length)

  return (
    <div className="dash">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Collection</span>
      </div>

      <header className="dash__intro">
        <div className="hero__eyebrow">Your collection</div>
        <h1 className="dash__title">
          {owned === 0
            ? <>Your first keepsake is <span className="accent">waiting</span>.</>
            : <><span className="accent">{owned}</span> expression{owned === 1 ? '' : 's'}, earned one day at a time.</>}
        </h1>
        <p className="dash__sub">
          Every day you complete the loop, that day’s native expression is yours
          for good. Miss a day, and its card stays sealed forever.
        </p>
        <div className="col__rank">
          <span className="col__rank-title">{rank.title}</span>
          <span className="col__rank-sub">
            {days.length} practice day{days.length === 1 ? '' : 's'}
            {rank.next && <> · {rank.next.title} at {rank.next.at}</>}
          </span>
        </div>
      </header>

      {loopDone ? (
        <section className="kseal kseal--open">
          <div className="kseal__label">Today’s keepsake — unsealed</div>
          <KeepsakeCard k={todayKeepsake} idx={todayIdx} date={new Date()} isToday />
        </section>
      ) : (
        <section className="kseal">
          <div className="kseal__label">Today’s keepsake — still sealed</div>
          <div className="kcard kcard--sealed">
            {/* Today's photo, veiled: a tease of what finishing the loop reveals */}
            <div className="kcard__photo kcard__photo--veiled" style={{ backgroundImage: `url(${photoForDay(todayIdx)})` }} aria-hidden="true" />
            <div className="kcard__body kcard__body--sealed">
              <span className="kcard__lock" aria-hidden="true">✦</span>
              <p className="kcard__sealedtext">
                Finish today’s loop to unseal a new native expression — and the
                photograph behind it.
              </p>
              <button className="task__go" onClick={onExit}>Back to the loop →</button>
            </div>
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="col__past">
          <div className="panel__head">
            <h2 className="panel__title">Earned so far</h2>
            <span className="panel__hint">{past.length} from past days</span>
          </div>
          <div className="col__grid">
            {past.map(({ date, idx }) => (
              <KeepsakeCard key={idx} k={keepsakeForDay(idx)} idx={idx} date={date} />
            ))}
          </div>
        </section>
      )}

      <button className="cta" onClick={onExit}>Back to today →</button>
    </div>
  )
}
