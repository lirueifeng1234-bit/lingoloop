import { supabase } from './supabase'
import { schedule } from './fsrs'

const nowISO = () => new Date().toISOString()

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
