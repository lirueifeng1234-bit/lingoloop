/*
 * Today's-tasks home — now fully live.
 * Streak, due-count, per-task completion, and the week strip all come from
 * Supabase (via props). The speaking prompt is the real rotating daily prompt,
 * shared with the speaking page.
 * Signature element: TodayArc — a memory-retention curve with today's tasks on it.
 */
import { pickPrompt, SPEAKING_MINUTES, VOCAB_MINUTES } from '../lib/prompts'
import { READING_MINUTES } from '../lib/reading'
import { pickWritingPrompt, WRITING_MINUTES } from '../lib/writing'
import { needsOwnKey } from '../lib/apiKey'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// The signature memory-retention curve, laid out data-driven so it holds any
// number of tasks (2–4) plus a terminal "Done" star. Nodes sit on a gentle
// sine crest; labels alternate below/above so they never crowd the line.
function TodayArc({ tasks }) {
  const allDone = tasks.every((t) => t.done)
  const pts = [
    ...tasks,
    { key: 'done', label: 'Done', sub: 'streak +1', done: allDone, color: 'var(--gold)', terminal: true },
  ]
  const n = pts.length
  const X0 = 64, X1 = 696, BASE = 138, AMP = 52
  const node = pts.map((p, i) => {
    const t = n === 1 ? 0 : i / (n - 1)
    return { ...p, x: X0 + t * (X1 - X0), y: BASE - AMP * Math.sin(Math.PI * t) }
  })
  const label = tasks.map((t) => t.label).join(', ')

  return (
    <svg className="arc-svg" viewBox="0 0 760 200" role="img"
      aria-label={`Today's path: ${label}, Done`}>
      {/* Segments — each lit by the task it leads out of, in that task's colour */}
      {node.slice(0, -1).map((a, i) => {
        const b = node[i + 1]
        const mx = (a.x + b.x) / 2
        return (
          <path key={`seg-${a.key}`} d={`M ${a.x} ${a.y} C ${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`}
            fill="none" stroke={a.color} strokeWidth={a.done ? 3 : 2} strokeLinecap="round"
            strokeDasharray={a.done ? '0' : '2 8'} opacity={a.done ? 1 : 0.5} />
        )
      })}

      {/* Nodes + alternating labels */}
      {node.map((p, i) => {
        const below = i % 2 === 0
        const ly = below ? p.y + 30 : p.y - 19
        const sy = below ? p.y + 46 : p.y - 35
        return (
          <g key={p.key}>
            {p.terminal ? (
              <>
                <circle cx={p.x} cy={p.y} r="7" fill="var(--card)" stroke="var(--gold)"
                  strokeWidth="2.5" strokeDasharray={allDone ? '0' : '2 3'} />
                <path transform={`translate(${p.x - 688} ${p.y - 121.7})`}
                  d="M 688 114.5 l 1.9 3.9 4.3 0.6 -3.1 3 0.7 4.3 -3.8 -2 -3.8 2 0.7 -4.3 -3.1 -3 4.3 -0.6 z"
                  fill="var(--gold)" opacity={allDone ? 0.95 : 0.25} />
              </>
            ) : (
              <circle cx={p.x} cy={p.y} r="7.5" fill={p.done ? p.color : 'var(--card)'}
                stroke={p.color} strokeWidth="2.5" />
            )}
            <text className="arc-node-label" x={p.x} y={ly} textAnchor="middle">{p.label}</text>
            <text className="arc-node-sub" x={p.x} y={sy} textAnchor="middle">
              {p.done && !p.terminal ? 'done ✓' : p.sub}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const FALLBACK_WEEK = [
  { day: 'M' }, { day: 'T' }, { day: 'W' }, { day: 'T' },
  { day: 'F' }, { day: 'S' }, { day: 'S' },
]

export default function Home({ stats = {}, prompt: propPrompt, email, onStartSpeaking, onStartVocab, onStartReading, onStartWriting, onOpenProgress, onOpenSettings, onSignOut }) {
  const prompt = propPrompt ?? pickPrompt()
  const writingPrompt = pickWritingPrompt()
  const streak = stats.streak ?? 0
  const due = stats.dueCount ?? 0
  const progress = stats.progress ?? { speaking: false, vocab: false, reading: false, writing: false }
  const week = stats.week ?? FALLBACK_WEEK
  const hasReading = !!onStartReading
  const hasWriting = !!onStartWriting

  // Non-owner users must add their own Gemini key before anything will work
  // (the server refuses to lend them the built-in key). Until they do, every
  // "start" sends them to Settings instead of into a call that would just fail.
  const needsKey = needsOwnKey(email)
  const guard = (fn) => (needsKey ? onOpenSettings : fn)

  const speakingDone = !!progress.speaking
  const vocabDone = !!progress.vocab
  const readingDone = !!progress.reading
  const writingDone = !!progress.writing

  // The loop, in order: speak → read (collect) → write (produce) → review.
  // Built as one list so the arc, counts, and next-action all stay in sync.
  const tasks = [
    { key: 'speaking', label: 'Speak', sub: `${SPEAKING_MINUTES} min`, done: speakingDone, color: 'var(--persimmon)' },
  ]
  if (hasReading) tasks.push({ key: 'reading', label: 'Read', sub: `${READING_MINUTES} min`, done: readingDone, color: 'var(--gold)' })
  if (hasWriting) tasks.push({ key: 'writing', label: 'Write', sub: `${WRITING_MINUTES} min`, done: writingDone, color: 'var(--teal)' })
  tasks.push({ key: 'vocab', label: 'Review', sub: `${due} due`, done: vocabDone, color: 'var(--persimmon-deep)' })

  const totalTasks = tasks.length
  const doneCount = tasks.filter((t) => t.done).length
  const allDone = doneCount === totalTasks
  const totalMin =
    SPEAKING_MINUTES + (hasReading ? READING_MINUTES : 0) + (hasWriting ? WRITING_MINUTES : 0) + VOCAB_MINUTES

  // Follow the loop: speak, read to collect, write to produce, then review it all.
  let next = null
  if (needsKey) next = { fn: onOpenSettings, label: 'Add your Gemini key to start' }
  else if (!speakingDone) next = { fn: onStartSpeaking, label: "Start today's session" }
  else if (hasReading && !readingDone) next = { fn: onStartReading, label: 'Read & collect' }
  else if (hasWriting && !writingDone) next = { fn: onStartWriting, label: 'Write today’s piece' }
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

        {needsKey && (
          <div className="keygate" role="note">
            <span className="keygate__icon" aria-hidden="true">🔑</span>
            <div className="keygate__body">
              <b>One quick setup step.</b> This account needs its own free Google
              Gemini key before you can practise — it keeps your usage on your own
              quota. It takes about a minute.
              <button className="keygate__link" onClick={onOpenSettings}>Open Settings →</button>
            </div>
          </div>
        )}

        <div className="arc-card">
          <div className="arc-card__head">
            <span className="arc-card__label">Today's loop</span>
            <span className="arc-card__meta"><b>{doneCount} / {totalTasks}</b> done</span>
          </div>
          <TodayArc tasks={tasks} />
        </div>

        {needsKey ? (
          <button className="cta" onClick={onOpenSettings}>
            Add your Gemini key to start
            <span className="cta__arrow" aria-hidden="true">→</span>
          </button>
        ) : next ? (
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
              <button className="task__go" onClick={guard(onStartSpeaking)}>
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
              <button className="task__go" onClick={guard(onStartVocab)}>
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
                <button className="task__go" onClick={guard(onStartReading)}>
                  {readingDone ? 'Again →' : 'Read →'}
                </button>
              </div>
            </article>
          )}

          {/* Writing */}
          {onStartWriting && (
            <article className={`task task--writing${writingDone ? ' is-done' : ''}`}>
              <div className="task__top">
                <span className="task__badge">
                  <span className="task__icon" aria-hidden="true">✍️</span>
                  Writing
                </span>
                <span className="task__count">{writingDone ? '✓ done' : <><b>1</b> draft</>}</span>
              </div>
              <h3 className="task__title">{writingPrompt.scenario}</h3>
              <p className="task__desc">{writingPrompt.text}</p>
              {writingPrompt.focus && <p className="task__focus">Targets: {writingPrompt.focus}</p>}
              <div className="task__foot">
                <span className="task__time">~{WRITING_MINUTES} min</span>
                <button className="task__go" onClick={guard(onStartWriting)}>
                  {writingDone ? 'Again →' : 'Write →'}
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

        <p className="note">Speaking, reading, writing, vocab &amp; streak are live · your errors and saved words flow into review</p>
        {email && (
          <p className="note note--auth">
            {email}
            {onOpenSettings && <> · <button className="signout" onClick={onOpenSettings}>Settings</button></>}
            {' · '}<button className="signout" onClick={onSignOut}>Sign out</button>
          </p>
        )}
      </section>
    </div>
  )
}
