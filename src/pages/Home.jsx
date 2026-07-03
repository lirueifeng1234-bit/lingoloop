/*
 * Today's-tasks home
 * Streak + vocab due-count are live from Supabase (via props).
 * The speaking prompt is still sample content — that module lands next stage.
 * Signature element: TodayArc — a memory-retention curve with today's tasks on it.
 */

// Sample content for the not-yet-built speaking module.
const SPEAKING = {
  title: 'Ordering at a café',
  desc: 'Practise the past tense you slipped on yesterday. Order in 3–4 sentences.',
  minutes: 8,
}
const VOCAB_MINUTES = 5

// This-week strip is still illustrative until we chart real sessions.
const WEEK = [
  { day: 'M', done: true }, { day: 'T', done: true }, { day: 'W', done: true },
  { day: 'T', done: true }, { day: 'F', done: false, today: true },
  { day: 'S', done: false }, { day: 'S', done: false },
]

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function TodayArc({ due }) {
  return (
    <svg className="arc-svg" viewBox="0 0 760 200" role="img"
      aria-label="Today's path: Speak, Vocab review, Done">
      <path d="M 80 132 C 210 70 300 72 380 86" fill="none"
        stroke="var(--persimmon)" strokeWidth="3" strokeLinecap="round" />
      <path d="M 380 86 C 470 102 560 140 680 108" fill="none"
        stroke="var(--teal)" strokeWidth="2" strokeLinecap="round"
        strokeDasharray="2 8" opacity="0.55" />

      {/* Node 1 — Speak */}
      <circle cx="80" cy="132" r="8" fill="var(--persimmon)" />
      <circle cx="80" cy="132" r="13" fill="none" stroke="var(--persimmon)" strokeWidth="1.5" opacity="0.35" />
      <text className="arc-node-label" x="80" y="168" textAnchor="middle">Speak</text>
      <text className="arc-node-sub" x="80" y="184" textAnchor="middle">{SPEAKING.minutes} min</text>

      {/* Node 2 — Vocab */}
      <circle cx="380" cy="86" r="7" fill="var(--card)" stroke="var(--teal)" strokeWidth="2.5" />
      <text className="arc-node-label" x="380" y="58" textAnchor="middle">Vocab</text>
      <text className="arc-node-sub" x="380" y="42" textAnchor="middle">{due} due</text>

      {/* Node 3 — Done */}
      <circle cx="680" cy="108" r="7" fill="var(--card)" stroke="var(--gold)" strokeWidth="2.5" strokeDasharray="2 3" />
      <path d="M 680 100.5 l 1.9 3.9 4.3 0.6 -3.1 3 0.7 4.3 -3.8 -2 -3.8 2 0.7 -4.3 -3.1 -3 4.3 -0.6 z"
        fill="var(--gold)" opacity="0.9" />
      <text className="arc-node-label" x="680" y="144" textAnchor="middle">Done</text>
      <text className="arc-node-sub" x="680" y="160" textAnchor="middle">streak +1</text>
    </svg>
  )
}

export default function Home({ stats = {}, email, onStartSpeaking, onStartVocab, onSignOut }) {
  const streak = stats.streak ?? 0
  const due = stats.dueCount ?? 0
  const totalMin = SPEAKING.minutes + VOCAB_MINUTES

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">Lingo<em>Loop</em></span>
          <span className="brand__tag">15 minutes a day</span>
        </div>
        <div className="streak" title="Consecutive days practised">
          <span className="streak__flame">🔥</span>
          <span className="streak__num">{streak}</span>
          <span className="streak__unit">day streak</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero__eyebrow">{greeting()} · Today</div>
        <h1 className="hero__title">
          <span className="accent">Speak</span> first — then lock it in.
        </h1>
        <p className="hero__sub">
          Your path for today is already set, so there's nothing to decide. Just follow
          the curve — about {totalMin} minutes.
        </p>

        <div className="arc-card">
          <div className="arc-card__head">
            <span className="arc-card__label">Today's loop</span>
            <span className="arc-card__meta"><b>0 / 2</b> done</span>
          </div>
          <TodayArc due={due} />
        </div>

        <button className="cta" onClick={onStartSpeaking}>
          Start today's session
          <span className="cta__time mono">{totalMin} min</span>
          <span className="cta__arrow" aria-hidden="true">→</span>
        </button>
      </section>

      <section className="tasks">
        <div className="tasks__head">
          <h2>Today's tasks</h2>
          <span>Speaking first · the rest fills in</span>
        </div>

        <div className="task-grid">
          {/* Speaking — not wired yet */}
          <article className="task task--speaking">
            <div className="task__top">
              <span className="task__badge">
                <span className="task__icon" aria-hidden="true">🎙️</span>
                Speaking
              </span>
              <span className="task__count"><b>1</b> prompt</span>
            </div>
            <h3 className="task__title">{SPEAKING.title}</h3>
            <p className="task__desc">{SPEAKING.desc}</p>
            <div className="task__foot">
              <span className="task__time">~{SPEAKING.minutes} min</span>
              <button className="task__go" onClick={onStartSpeaking}>Start →</button>
            </div>
          </article>

          {/* Vocab — live */}
          <article className="task task--vocab">
            <div className="task__top">
              <span className="task__badge">
                <span className="task__icon" aria-hidden="true">🗂️</span>
                Review
              </span>
              <span className="task__count"><b>{due}</b> due</span>
            </div>
            <h3 className="task__title">Spaced review</h3>
            <p className="task__desc">
              Words from your speaking feedback and reading. Scheduled with FSRS — only
              what's due today.
            </p>
            <div className="task__foot">
              <span className="task__time">~{VOCAB_MINUTES} min</span>
              <button className="task__go" onClick={onStartVocab}>
                {due > 0 ? 'Start →' : 'Review →'}
              </button>
            </div>
          </article>
        </div>

        <div className="week">
          <span className="week__label">This week</span>
          <div className="week__dots">
            {WEEK.map((d, i) => (
              <div key={i} className={`dot${d.done ? ' dot--done' : ''}${d.today ? ' dot--today' : ''}`}>
                <span className="dot__day">{d.day}</span>
                <span className="dot__mark">{d.done && <span className="dot__check">✓</span>}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="note">Speaking, vocab &amp; streak are live · your errors and new words flow into review</p>
        {email && (
          <p className="note note--auth">
            {email} · <button className="signout" onClick={onSignOut}>Sign out</button>
          </p>
        )}
      </section>
    </div>
  )
}
