import { supabase } from './supabase'
import { schedule } from './fsrs'
import { pickPrompt } from './prompts'
import { pickPassage } from './reading'
import { withUserKey } from './apiKey'

const nowISO = () => new Date().toISOString()
const midnightISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// A small starter deck so the review loop has something to chew on day one.
// Tuned loosely for a medical / investment reader. Delete freely later.
const STARTER = [
  { word: 'nevertheless', definition: 'in spite of that; even so', example: 'The drug is expensive; nevertheless, it is widely prescribed.' },
  { word: 'leverage', definition: 'use borrowed capital to amplify returns (and risk)', example: 'High leverage magnified the fund’s losses.' },
  { word: 'chronic', definition: 'lasting a long time; persistent', example: 'She manages a chronic condition with daily medication.' },
  { word: 'mitigate', definition: 'make less severe or harmful', example: 'Diversification helps mitigate downside risk.' },
  { word: 'prevalent', definition: 'widespread in a particular area or time', example: 'The mutation is prevalent among older patients.' },
  { word: 'underlying', definition: 'forming the basis; not immediately obvious', example: 'We need to treat the underlying cause, not the symptom.' },
  { word: 'robust', definition: 'strong and able to withstand stress', example: 'The results held up under a robust set of assumptions.' },
  { word: 'subtle', definition: 'delicate; not obvious', example: 'There was a subtle shift in the earnings guidance.' },
]

// Insert the starter deck once, only if this user has no words yet.
export async function ensureStarterDeck(userId) {
  const { count, error } = await supabase
    .from('vocabulary')
    .select('id', { count: 'exact', head: true })
  if (error) throw error
  if (count && count > 0) return
  const rows = STARTER.map((w) => ({ ...w, user_id: userId, source: 'starter' }))
  const { error: insErr } = await supabase.from('vocabulary').insert(rows)
  if (insErr) throw insErr
}

// How many cards are due right now.
export async function getDueCount() {
  const { count, error } = await supabase
    .from('vocabulary')
    .select('id', { count: 'exact', head: true })
    .lte('due', nowISO())
  if (error) throw error
  return count ?? 0
}

// Due cards, soonest first.
export async function getDueCards(limit = 50) {
  const { data, error } = await supabase
    .from('vocabulary')
    .select('*')
    .lte('due', nowISO())
    .order('due', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Persist an FSRS review outcome for one card.
export async function reviewCard(row, rating) {
  const patch = schedule(row, rating)
  const { error } = await supabase.from('vocabulary').update(patch).eq('id', row.id)
  if (error) throw error
}

// Record a finished practice session (feeds streak + frequency stats).
export async function logSession(skillType, durationSec, userId) {
  const { error } = await supabase.from('practice_sessions').insert({
    skill_type: skillType,
    duration_sec: durationSec,
    user_id: userId,
  })
  if (error) throw error
}

// Which of today's tasks are already done (based on sessions logged today).
export async function getTodayProgress() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('skill_type')
    .gte('created_at', start.toISOString())
  if (error) throw error
  const kinds = new Set((data ?? []).map((r) => r.skill_type))
  return {
    // 'talk' rows are legacy pre-merge sessions — they were speaking practice too.
    speaking: kinds.has('speaking') || kinds.has('talk'),
    vocab: kinds.has('vocab'),
    reading: kinds.has('reading'),
    writing: kinds.has('writing'),
  }
}

// ── Live Talk ────────────────────────────────────────────────────────────
// The data the daily conversation prompt is personalized with: recent
// mistakes to listen for, and words worth recycling (due first, then newest).
export async function getTalkFuel() {
  const [errors, dueRes, recentRes] = await Promise.all([
    getRecentErrors(8),
    supabase.from('vocabulary').select('word, definition').lte('due', nowISO())
      .order('due', { ascending: true }).limit(8),
    supabase.from('vocabulary').select('word, definition')
      .order('created_at', { ascending: false }).limit(8),
  ])
  if (dueRes.error) throw dueRes.error
  if (recentRes.error) throw recentRes.error
  const seen = new Set()
  const words = []
  for (const w of [...(dueRes.data ?? []), ...(recentRes.data ?? [])]) {
    if (words.length >= 8 || seen.has(w.word)) continue
    seen.add(w.word)
    words.push(w)
  }
  return { errors, words }
}

// Run the AI debrief over a pasted voice-conversation transcript. The heavy
// analysis happens server-side (debrief-talk edge function → Gemini): voice
// models write lazy end-of-chat notes, but a strong text model reading the
// whole transcript produces real coaching. Throws so the UI can fall back
// to the offline notes parser.
export async function debriefSession({ transcript, sessionTitle, personaName }) {
  const { data, error } = await supabase.functions.invoke('debrief-talk', {
    body: withUserKey({ transcript, sessionTitle, personaName }),
  })
  if (error) throw error
  if (!data || data.error || !Array.isArray(data.upgrades)) {
    throw new Error(data?.error || 'debrief failed')
  }
  return data
}

// Bank a debrief: every upgrade and new expression becomes a review card
// (native phrase + the why + usage guidance + a range example), and every
// upgrade also becomes an errors row — the weak-spots log that tunes
// tomorrow's session prompt.
export async function saveDebrief(userId, d) {
  const seen = new Set()
  const words = []
  const addWord = (phrase, definition, example) => {
    const word = String(phrase || '').toLowerCase().trim()
    if (!word || seen.has(word)) return
    seen.add(word)
    words.push({ user_id: userId, word, definition: definition || null, example: example || null, source: 'talk' })
  }
  for (const u of d.upgrades ?? []) {
    addWord(u.native, [u.why, u.use_when ? `Use it: ${u.use_when}` : null].filter(Boolean).join(' · '), u.example)
  }
  for (const x of d.new_expressions ?? []) {
    addWord(x.phrase, [x.meaning, x.use_when ? `Use it: ${x.use_when}` : null].filter(Boolean).join(' · '), x.example)
  }
  if (words.length) {
    const { error } = await supabase.from('vocabulary').upsert(words, {
      onConflict: 'user_id,word',
      ignoreDuplicates: true,
    })
    if (error) throw error
  }

  const errs = []
  for (const u of d.upgrades ?? []) {
    if (u.you_said && u.native) {
      errs.push({
        user_id: userId,
        error_type: 'word_choice',
        original: u.you_said,
        correction: u.native,
        note: u.why || u.use_when || null,
        source_module: 'speaking',
      })
    }
  }
  for (const p of d.pronunciation ?? []) {
    if (p.word && p.tip) {
      errs.push({
        user_id: userId,
        error_type: 'pronunciation',
        original: p.word,
        correction: p.tip,
        note: null,
        source_module: 'speaking',
      })
    }
  }
  if (errs.length) {
    const { error } = await supabase.from('errors').insert(errs)
    if (error) throw error
  }

  return { words: words.length, corrections: errs.length }
}

// Bank the parsed session notes: each expression becomes a review card
// (meaning + usage guidance + context example), and each correction /
// pronunciation fix becomes an errors row — which feeds straight back into
// tomorrow's session prompt as a known weak spot. `notes` is the output of
// parseNotes() in lib/talk.js.
export async function saveSessionNotes(userId, notes) {
  const expressions = notes?.expressions ?? []

  const words = expressions
    .filter((x) => x.phrase)
    .map((x) => ({
      user_id: userId,
      word: x.phrase.toLowerCase().trim(),
      definition: [x.meaning, x.useIt ? `Use it: ${x.useIt}` : null].filter(Boolean).join(' · ') || null,
      example: x.example || null,
      source: 'talk',
    }))
  if (words.length) {
    const { error } = await supabase.from('vocabulary').upsert(words, {
      onConflict: 'user_id,word',
      ignoreDuplicates: true,
    })
    if (error) throw error
  }

  const errs = []
  for (const x of expressions) {
    const said = (x.youSaid || '').trim()
    if (said && !/^new$/i.test(said.replace(/[."”]/g, ''))) {
      errs.push({
        user_id: userId,
        error_type: 'word_choice',
        original: said,
        correction: x.phrase,
        note: x.useIt || x.meaning || null,
        source_module: 'speaking',
      })
    }
  }
  for (const p of notes?.pronunciation ?? []) {
    if (p.word && p.tip) {
      errs.push({
        user_id: userId,
        error_type: 'pronunciation',
        original: p.word,
        correction: p.tip,
        note: null,
        source_module: 'speaking',
      })
    }
  }
  if (errs.length) {
    const { error } = await supabase.from('errors').insert(errs)
    if (error) throw error
  }

  return { words: words.length, corrections: errs.length }
}

// ── Keepsake collection ──────────────────────────────────────────────────
// Every distinct local day with any practice, oldest first, as Date objects
// pinned to local midnight. The collection page derives all unlocks from this.
export async function getActiveDays() {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('created_at')
  if (error) throw error
  const keys = new Set((data ?? []).map((r) => {
    const d = new Date(r.created_at)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }))
  return [...keys].sort((a, b) => a - b).map((t) => new Date(t))
}

// This calendar week's activity (Mon–Sun): which days had any practice.
export async function getWeekActivity() {
  const now = new Date()
  const monday = new Date(now)
  const mondayOffset = (now.getDay() + 6) % 7 // Sun=0 -> 6, Mon=1 -> 0, ...
  monday.setDate(now.getDate() - mondayOffset)
  monday.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('practice_sessions')
    .select('created_at')
    .gte('created_at', monday.toISOString())
  if (error) throw error

  const activeDays = new Set((data ?? []).map((r) => new Date(r.created_at).toDateString()))
  const todayStr = now.toDateString()
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return labels.map((day, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = d.toDateString()
    return { day, done: activeDays.has(key), today: key === todayStr }
  })
}

// Consecutive-day streak ending today (or yesterday, if today isn't done yet).
export async function getStreak() {
  const { data, error } = await supabase
    .from('practice_sessions')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(180)
  if (error) throw error
  if (!data || data.length === 0) return 0

  const days = new Set(data.map((r) => new Date(r.created_at).toDateString()))
  const d = new Date()
  if (!days.has(d.toDateString())) {
    d.setDate(d.getDate() - 1)
    if (!days.has(d.toDateString())) return 0
  }
  let streak = 0
  while (days.has(d.toDateString())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── Dynamic speaking prompts ─────────────────────────────────────────────
// The day's prompt is generated from the learner's recent mistakes, then
// cached so it's stable within the day and costs at most one Gemini call/day.

// Recent mistakes to target — newest first.
export async function getRecentErrors(limit = 12) {
  const { data, error } = await supabase
    .from('errors')
    .select('error_type, original, correction, note')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Scenarios we've already used — fed to the generator as a do-not-repeat list.
export async function getRecentScenarios(limit = 20) {
  const { data, error } = await supabase
    .from('speaking_prompts')
    .select('scenario, prompt_text')
    .not('user_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => `${r.scenario}: ${r.prompt_text}`)
}

// Today's already-generated prompt, if there is one (keeps it stable on reload).
// Note: the `focus` line lives only in-memory for the freshly generated prompt;
// it isn't stored, so a reload shows the same task without the "Targets" hint.
export async function getTodayPrompt() {
  const { data, error } = await supabase
    .from('speaking_prompts')
    .select('scenario, prompt_text')
    .not('user_id', 'is', null)
    .gte('created_at', midnightISO())
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  const row = data?.[0]
  return row ? { scenario: row.scenario, text: row.prompt_text, focus: null } : null
}

async function saveTodayPrompt(userId, { scenario, text, difficulty }) {
  const { error } = await supabase.from('speaking_prompts').insert({
    user_id: userId,
    scenario,
    prompt_text: text,
    difficulty: difficulty ?? 3,
  })
  if (error) throw error
}

// Resolve the prompt to show today: cached → generated-from-errors → static.
export async function resolveTodayPrompt(userId) {
  // 1. Same prompt for the rest of the day if we already made one.
  try {
    const cached = await getTodayPrompt()
    if (cached) return cached
  } catch { /* fall through to generation */ }

  // 2. Generate one tuned to recent mistakes, avoiding past scenarios.
  try {
    const [errors, recentScenarios] = await Promise.all([
      getRecentErrors(12),
      getRecentScenarios(20),
    ])
    const { data, error } = await supabase.functions.invoke('generate-prompt', {
      body: withUserKey({ errors, recentScenarios }),
    })
    if (!error && data && data.prompt_text) {
      const prompt = {
        scenario: data.scenario,
        text: data.prompt_text,
        focus: data.focus ?? null,
      }
      // Best-effort cache; don't block on it.
      saveTodayPrompt(userId, { ...prompt, difficulty: data.difficulty }).catch(() => {})
      return prompt
    }
  } catch { /* fall through to static */ }

  // 3. Last resort so the UI always has a task.
  return pickPrompt()
}

// ── Progress dashboard ───────────────────────────────────────────────────
// One bundle of everything the dashboard draws: error-category mix,
// vocabulary growth, and practice consistency. All shaped client-side so the
// page stays a dumb renderer.
export async function getDashboard() {
  const [errRes, vocRes, sesRes] = await Promise.all([
    supabase.from('errors').select('error_type, created_at'),
    supabase.from('vocabulary').select('created_at, state, source'),
    supabase.from('practice_sessions').select('created_at'),
  ])
  if (errRes.error) throw errRes.error
  if (vocRes.error) throw vocRes.error
  if (sesRes.error) throw sesRes.error

  const errors = errRes.data ?? []
  const vocab = vocRes.data ?? []
  const sessions = sesRes.data ?? []

  // Error categories — where their gaps concentrate.
  const catMap = {}
  for (const e of errors) {
    const k = (e.error_type || 'other').trim().toLowerCase()
    catMap[k] = (catMap[k] || 0) + 1
  }
  const categories = Object.entries(catMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)

  // Vocabulary — totals and a cumulative growth curve (one point per active day).
  const totalWords = vocab.length
  const masteredWords = vocab.filter((v) => (v.state ?? 0) >= 2).length
  const fromSpeaking = vocab.filter((v) => v.source === 'speaking').length
  const perDay = {}
  for (const v of vocab) {
    const key = new Date(v.created_at).toISOString().slice(0, 10)
    perDay[key] = (perDay[key] || 0) + 1
  }
  let running = 0
  const growth = Object.keys(perDay)
    .sort()
    .map((date) => ({ date, total: (running += perDay[date]) }))

  // Consistency — streaks and a 14-day activity strip.
  const daySet = new Set(sessions.map((s) => new Date(s.created_at).toDateString()))
  let current = 0
  const dc = new Date()
  if (!daySet.has(dc.toDateString())) dc.setDate(dc.getDate() - 1)
  while (daySet.has(dc.toDateString())) { current++; dc.setDate(dc.getDate() - 1) }

  const sortedDays = [...daySet].map((s) => new Date(s)).sort((a, b) => a - b)
  let longest = 0, run = 0, prev = null
  for (const d of sortedDays) {
    run = prev && (d - prev) <= 86400000 * 1.5 ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }

  const recent = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    recent.push({ label: d.toDateString(), done: daySet.has(d.toDateString()) })
  }

  return {
    categories,
    totalWords,
    masteredWords,
    fromSpeaking,
    growth,
    current,
    longest,
    recent,
    totalSessions: sessions.length,
    totalCorrections: errors.length,
  }
}

// ── Reading module ───────────────────────────────────────────────────────
// A fresh C1–C2 passage is Gemini-generated, then cached in localStorage for
// the day so a reload (and the free tier) isn't hit repeatedly. Tapped words
// resolve from the passage glossary first, then a live in-context lookup.

const READ_CACHE_KEY = 'll_reading_current'
const READ_TOPICS_KEY = 'll_reading_topics'

const localDay = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(READ_CACHE_KEY) || 'null') } catch { return null }
}
function writeCache(article) {
  try { localStorage.setItem(READ_CACHE_KEY, JSON.stringify({ date: localDay(), article })) } catch { /* ignore */ }
}
function recentTopics() {
  try { return JSON.parse(localStorage.getItem(READ_TOPICS_KEY) || '[]') } catch { return [] }
}
function rememberTopic(topic) {
  if (!topic) return
  try {
    const next = [topic, ...recentTopics().filter((t) => t !== topic)].slice(0, 12)
    localStorage.setItem(READ_TOPICS_KEY, JSON.stringify(next))
  } catch { /* ignore */ }
}

// Resolve today's passage: cached → freshly generated → static fallback.
// Pass { force: true } to skip the cache and generate a brand-new one.
export async function resolveTodayReading({ force = false } = {}) {
  if (!force) {
    const cached = readCache()
    if (cached && cached.date === localDay() && cached.article) return cached.article
  }

  try {
    const { data, error } = await supabase.functions.invoke('generate-reading', {
      body: withUserKey({ recentTopics: recentTopics() }),
    })
    if (!error && data && data.body) {
      writeCache(data)
      rememberTopic(data.topic)
      return data
    }
  } catch { /* fall through to static */ }

  return pickPassage()
}

// In-context lookup for a tapped word. Throws on failure so the UI can react.
export async function lookupWord(word, context) {
  const { data, error } = await supabase.functions.invoke('lookup-word', {
    body: withUserKey({ word, context }),
  })
  if (error) throw error
  if (!data || data.error || !data.definition) throw new Error(data?.error || 'lookup failed')
  return data
}

// Save one word to the review deck (deduped on user_id,word). Returns true on success.
export async function saveVocabWord(userId, { word, definition, example }) {
  const clean = String(word || '').toLowerCase().trim()
  if (!clean) return false
  const { error } = await supabase.from('vocabulary').upsert(
    [{ user_id: userId, word: clean, definition: definition ?? null, example: example ?? null, source: 'reading' }],
    { onConflict: 'user_id,word', ignoreDuplicates: true },
  )
  if (error) throw error
  return true
}
