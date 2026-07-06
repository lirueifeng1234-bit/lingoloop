/*
 * Today's-tasks home — now fully live.
 * Streak, due-count, per-task completion, and the week strip all come from
 * Supabase (via props). The speaking prompt is the real rotating daily prompt,
 * shared with the speaking page.
 * Signature element: TodayArc — a memory-retention curve with today's tasks on it.
 */
import { pickPrompt, SPEAKING_MINUTES, VOCAB_MINUTES } from '../lib/prompts'
import { READING_MINUTES } from '../lib/reading'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function TodayArc({ due, speakingDone, readingDone, vocabDone }) {
  const allDone = speakingDone && readingDone && vocabDone
  return (
    <svg className="arc-svg" viewBox="0 0 760 200" role="img"
      aria-label="Today's path: Speak, Read, Review, Done">
      {/* Speak → Read */}
      <path d="M 72 140 C 140 96 200 84 268 90" fill="none"
        stroke="var(--persimmon)" strokeWidth={speakingDone ? 3 : 2} strokeLinecap="round"
        strokeDasharray={speakingDone ? '0' : '2 8'} opacity={speakingDone ? 1 : 0.5} />
      {/* Read → Review */}
      <path d="M 268 90 C 342 96 420 96 488 98" fill="none"
        stroke="var(--gold)" strokeWidth={readingDone ? 3 : 2} strokeLinecap="round"
        strokeDasharray={readingDone ? '0' : '2 8'} opacity={readingDone ? 1 : 0.5} />
      {/* Review → Done */}
      <path d="M 488 98 C 560 102 620 110 688 122" fill="none"
        stroke="var(--teal)" strokeWidth={vocabDone ? 3 : 2} strokeLinecap="round"
        strokeDasharray={vocabDone ? '0' : '2 8'} opacity={vocabDone ? 1 : 0.55} />

      {/* Node 1 — Speak */}
      <circle cx="72" cy="140" r="8" fill={speakingDone ? 'var(--persimmon)' : 'var(--card)'}
        stroke="var(--persimmon)" strokeWidth="2.5" />
      <text className="arc-node-label" x="72" y="172" textAnchor="middle">Speak</text>
      <text className="arc-node-sub" x="72" y="188" textAnchor="middle">{speakingDone ? 'done ✓' : `${SPEAKING_MINUTES} min`}</text>

      {/* Node 2 — Read */}
      <circle cx="268" cy="90" r="7" fill={readingDone ? 'var(--gold)' : 'var(--card)'} stroke="var(--gold)" strokeWidth="2.5" />
      <text className="arc-node-label" x="268" y="62" textAnchor="middle">Read</text>
      <text className="arc-node-sub" x="268" y="46" textAnchor="middle">{readingDone ? 'done ✓' : `${READING_MINUTES} min`}</text>

      {/* Node 3 — Review */}
      <circle cx="488" cy="98" r="7" fill={vocabDone ? 'var(--teal)' : 'var(--card)'} stroke="var(--teal)" strokeWidth="2.5" />
      <text className="arc-node-label" x="488" y="130" textAnchor="middle">Review</text>
      <text className="arc-node-sub" x="488" y="146" textAnchor="middle">{vocabDone ? 'done ✓' : `${due} due`}</text>

      {/* Node 4 — Done */}
      <circle cx="688" cy="122" r="7" fill="var(--card)" stroke="var(--gold)" strokeWidth="2.5" strokeDasharray={allDone ? '0' : '2 3'} />
      <path d="M 688 114.5 l 1.9 3.9 4.3 0.6 -3.1 3 0.7 4.3 -3.8 -2 -3.8 2 0.7 -4.3 -3.1 -3 4.3 -0.6 z"
        fill="var(--gold)" opacity={allDone ? 0.95 : 0.25} />
      <text className="arc-node-label" x="688" y="158" textAnchor="middle">Done</text>
      <text className="arc-node-sub" x="688" y="174" textAnchor="middle">streak +1</text>
    </svg>
  )
}

const FALLBACK_WEEK = [
  { day: 'M' }, { day: 'T' }, { day: 'W' }, { day: 'T' },
  { day: 'F' }, { day: 'S' }, { day: 'S' },
]

export default function Home({ stats = {}, prompt: propPrompt, email, onStartSpeaking, onStartVocab, onStartReading, onOpenProgress, onSignOut }) {
  const prompt = propPrompt ?? pickPrompt()
  const streak = stats.streak ?? 0
  const due = stats.dueCount ?? 0
  const progress = stats.progress ?? { speaking: false, vocab: false, reading: false }
  const week = stats.week ?? FALLBACK_WEEK
  const hasReading = !!onStartReading
  const totalMin = SPEAKING_MINUTES + (hasReading ? READING_MINUTES : 0) + VOCAB_MINUTES

  const speakingDone = !!progress.speaking
  const vocabDone = !!progress.vocab
  const readingDone = !!progress.reading
  const totalTasks = hasReading ? 3 : 2
  const doneCount = (speakingDone ? 1 : 0) + (hasReading && readingDone ? 1 : 0) + (vocabDone ? 1 : 0)
  const allDone = doneCount === totalTasks

  // Follow the loop: speak, then read to collect words, then review them all.
  let next = null
  if (!speakingDone) next = { fn: onStartSpeaking, label: "Start today's session" }
  else if (hasReading && !readingDone) next = { fn: onStartReading, label: 'Read & collect' }
  else if (!vocabDone) next = { fn: onStartVocab, label: due > 0 ? 'Review your words' : 'Quick review' }

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
          {allDone
            ? <>That’s a wrap for <span className="accent">today</span>.</>
            : <><span className="accent">Speak</span> first — then lock it in.</>}
        </h1>
        <p className="hero__sub">
          {allDone
            ? 'Every task done — your streak is safe. Come back tomorrow for a fresh loop.'
            : <>Your path for today is already set, so there’s nothing to decide. Just follow the curve — about {totalMin} minutes.</>}
        </p>

        <div className="arc-card">
          <div className="arc-card__head">
            <span className="arc-card__label">Today's loop</span>
            <span className="arc-card__meta"><b>{doneCount} / {totalTasks}</b> done</span>
          </div>
          <TodayArc due={due} speakingDone={speakingDone} readingDone={readingDone} vocabDone={vocabDone} />
        </div>

        {next ? (
          <button className="cta" onClick={next.fn}>
            {next.label}
            <span className="cta__time mono">{totalMin} min</span>
            <span className="cta__arrow" aria-hidden="true">→</span>
          </button>
        ) : (
          <div className="cta cta--done">✓ Today’s loop complete</div>
        )}
      </section>

      <section className="tasks">
        <div className="tasks__head">
          <h2>Today's tasks</h2>
          <span>Speaking first · the rest fills in</span>
        </div>

        <div className="task-grid">
          {/* Speaking */}
          <article className={`task task--speaking${speakingDone ? ' is-done' : ''}`}>
            <div className="task__top">
              <span className="task__badge">
                <span className="task__icon" aria-hidden="true">🎙️</span>
                Speaking
              </span>
              <span className="task__count">{speakingDone ? '✓ done' : <><b>1</b> prompt</>}</span>
            </div>
            <h3 className="task__title">{prompt.scenario}</h3>
            <p className="task__desc">{prompt.text}</p>
            {prompt.focus && <p className="task__focus">Targets: {prompt.focus}</p>}
            <div className="task__foot">
              <span className="task__time">~{SPEAKING_MINUTES} min</span>
              <button className="task__go" onClick={onStartSpeaking}>
                {speakingDone ? 'Again →' : 'Start →'}
              </button>
            </div>
          </article>

          {/* Vocab */}
          <article className={`task task--vocab${vocabDone ? ' is-done' : ''}`}>
            <div className="task__top">
              <span className="task__badge">
                <span className="task__icon" aria-hidden="true">🗂️</span>
                Review
              </span>
              <span className="task__count">{vocabDone ? '✓ done' : <><b>{due}</b> due</>}</span>
            </div>
            <h3 className="task__title">Spaced review</h3>
            <p className="task__desc">
              Words from your speaking feedback and reading. Scheduled with FSRS — only
              what's due today.
            </p>
            <div className="task__foot">
              <span className="task__time">~{VOCAB_MINUTES} min</span>
              <button className="task__go" onClick={onStartVocab}>
                {vocabDone ? 'Again →' : due > 0 ? 'Start →' : 'Review →'}
              </button>
            </div>
          </article>

          {/* Reading */}
          {onStartReading && (
            <article className={`task task--reading${readingDone ? ' is-done' : ''}`}>
              <div className="task__top">
                <span className="task__badge">
                  <span className="task__icon" aria-hidden="true">📖</span>
                  Reading
                </span>
                <span className="task__count">{readingDone ? '✓ done' : <><b>1</b> passage</>}</span>
              </div>
              <h3 className="task__title">Read &amp; collect</h3>
              <p className="task__desc">
                A fresh C1–C2 article. Tap any word for an instant definition and send
                the keepers straight to your review deck.
              </p>
              <div className="task__foot">
                <span className="task__time">~{READING_MINUTES} min</span>
                <button className="task__go" onClick={onStartReading}>
                  {readingDone ? 'Again →' : 'Read →'}
                </button>
              </div>
            </article>
          )}
        </div>

        <div className="week">
          <span className="week__label">This week</span>
          <div className="week__dots">
            {week.map((d, i) => (
              <div key={i} className={`dot${d.done ? ' dot--done' : ''}${d.today ? ' dot--today' : ''}`}>
                <span className="dot__day">{d.day}</span>
                <span className="dot__mark">{d.done && <span className="dot__check">✓</span>}</span>
              </div>
            ))}
          </div>
        </div>

        {onOpenProgress && (
          <button className="progress-link" onClick={onOpenProgress}>See your full progress →</button>
        )}

        <p className="note">Speaking, reading, vocab &amp; streak are live · your errors and saved words flow into review</p>
        {email && (
          <p className="note note--auth">
            {email} · <button className="signout" onClick={onSignOut}>Sign out</button>
          </p>
        )}
      </section>
    </div>
  )
}
