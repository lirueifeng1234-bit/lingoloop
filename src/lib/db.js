import { supabase } from './supabase'
import { schedule } from './fsrs'
import { pickPrompt } from './prompts'

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
  return { speaking: kinds.has('speaking'), vocab: kinds.has('vocab') }
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
      body: { errors, recentScenarios },
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
