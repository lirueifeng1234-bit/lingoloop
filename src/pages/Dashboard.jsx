/*
 * Progress dashboard — proof the gap to native is closing.
 * Three lenses: vocabulary growth (the signature curve, echoing the home arc),
 * what you're polishing (error-category mix), and consistency (streaks).
 * Charts are hand-built SVG so they stay on-brand and add no dependencies.
 */
import { useEffect, useState } from 'react'
import { getDashboard } from '../lib/db'

const CAT_LABEL = {
  grammar: 'Grammar',
  collocation: 'Collocation',
  idiom: 'Idiom',
  'word choice': 'Word choice',
  register: 'Register & tone',
  naturalness: 'Naturalness',
  wordiness: 'Wordiness',
  other: 'Other',
}
const catLabel = (t) => CAT_LABEL[t] || t.charAt(0).toUpperCase() + t.slice(1)

function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function GrowthCurve({ growth }) {
  const W = 640, H = 200, padX = 18, padTop = 22, padBot = 30
  if (!growth || growth.length === 0) {
    return <p className="panel__empty">Your first saved words will start this curve — finish a speaking session to plant them.</p>
  }
  const max = Math.max(...growth.map((p) => p.total), 1)
  const n = growth.length
  const x = (i) => (n === 1 ? W / 2 : padX + (i / (n - 1)) * (W - 2 * padX))
  const y = (v) => padTop + (1 - v / max) * (H - padTop - padBot)
  const pts = growth.map((p, i) => [x(i), y(p.total)])
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'} ${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const base = (H - padBot).toFixed(1)
  const area = `${line} L ${x(n - 1).toFixed(1)} ${base} L ${x(0).toFixed(1)} ${base} Z`
  const last = pts[pts.length - 1]

  return (
    <svg className="growth" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vocabulary growth over time">
      <defs>
        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={padX} y1={base} x2={W - padX} y2={base} stroke="var(--line)" strokeWidth="1" />
      <path d={area} fill="url(#growthFill)" />
      <path d={line} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--card)" stroke="var(--teal)" strokeWidth="2.5" />
      <text className="growth__val" x={last[0]} y={last[1] - 12} textAnchor="middle">{growth[n - 1].total}</text>
      <text className="growth__ax" x={padX} y={H - 9} textAnchor="start">{fmtDate(growth[0].date)}</text>
      {n > 1 && <text className="growth__ax" x={W - padX} y={H - 9} textAnchor="end">{fmtDate(growth[n - 1].date)}</text>}
    </svg>
  )
}

function ErrorBars({ categories }) {
  if (!categories || categories.length === 0) {
    return <p className="panel__empty">Nothing flagged yet — once you speak, this shows exactly which habits to polish.</p>
  }
  const top = categories.slice(0, 7)
  const max = Math.max(...top.map((c) => c.count), 1)
  return (
    <div className="bars">
      {top.map((c) => (
        <div className="bar" key={c.type}>
          <span className="bar__label">{catLabel(c.type)}</span>
          <span className="bar__track"><i style={{ width: `${Math.max(6, (c.count / max) * 100)}%` }} /></span>
          <span className="bar__count">{c.count}</span>
        </div>
      ))}
    </div>
  )
}

function ActivityStrip({ recent }) {
  return (
    <div className="spark" role="img" aria-label="Practice activity, last 14 days">
      {recent.map((d, i) => (
        <span key={i} className={`spark__bar${d.done ? ' is-on' : ''}`} title={d.label} />
      ))}
    </div>
  )
}

function Stat({ num, label, tone }) {
  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__num">{num}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}

export default function Dashboard({ onExit }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    getDashboard()
      .then((d) => { if (alive) setData(d) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  if (failed) {
    return (
      <div className="dash">
        <div className="speak__bar"><button className="review__back" onClick={onExit}>← Today</button></div>
        <div className="review__done">
          <h1>Couldn’t load your progress</h1>
          <p>Check your connection and try again.</p>
          <button className="cta" onClick={onExit}>Back to today →</button>
        </div>
      </div>
    )
  }

  if (!data) {
    return <div className="dash"><p className="review__state">Crunching your numbers…</p></div>
  }

  const {
    categories, totalWords, masteredWords, fromSpeaking, growth,
    current, longest, recent, totalSessions, totalCorrections,
  } = data

  return (
    <div className="dash">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Progress</span>
      </div>

      <header className="dash__intro">
        <div className="hero__eyebrow">Your progress</div>
        <h1 className="dash__title">You’re closing the gap to <span className="accent">native</span>.</h1>
        <p className="dash__sub">
          Every word you bank and every phrasing you refine is one less thing between
          you and effortless English. Here’s the shape of it.
        </p>
      </header>

      <div className="dash__stats">
        <Stat num={current} label="day streak" tone="gold" />
        <Stat num={totalWords} label="words banked" tone="teal" />
        <Stat num={masteredWords} label="mastered" tone="teal" />
        <Stat num={totalCorrections} label="refinements" tone="persimmon" />
      </div>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Vocabulary growth</h2>
          <span className="panel__hint">{fromSpeaking} from speaking</span>
        </div>
        <GrowthCurve growth={growth} />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">What you’re polishing</h2>
          <span className="panel__hint">{totalCorrections} total</span>
        </div>
        <p className="panel__lead">The habits your coach flags most. The goal isn’t zero — it’s watching the top bars shrink as they become second nature.</p>
        <ErrorBars categories={categories} />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Consistency</h2>
          <span className="panel__hint">last 14 days</span>
        </div>
        <ActivityStrip recent={recent} />
        <div className="dash__streaks">
          <span><b>{current}</b> current</span>
          <span><b>{longest}</b> longest</span>
          <span><b>{totalSessions}</b> sessions</span>
        </div>
      </section>

      <button className="cta" onClick={onExit}>Back to today →</button>
    </div>
  )
}
