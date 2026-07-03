import { fsrs, Rating, State } from 'ts-fsrs'

// Default FSRS scheduler. Params can be tuned later from the user's own history.
const f = fsrs()

// Shown as the four review buttons, in order.
export const RATINGS = [
  { key: Rating.Again, label: 'Forgot', hint: 'no idea', variant: 'again' },
  { key: Rating.Hard, label: 'Hard', hint: 'barely', variant: 'hard' },
  { key: Rating.Good, label: 'Good', hint: 'recalled', variant: 'good' },
  { key: Rating.Easy, label: 'Easy', hint: 'instant', variant: 'easy' },
]

// DB row -> ts-fsrs Card
function rowToCard(row) {
  return {
    due: new Date(row.due),
    stability: row.stability ?? 0,
    difficulty: row.difficulty ?? 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: row.reps ?? 0,
    lapses: row.lapses ?? 0,
    state: row.state ?? State.New,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

// Given a vocab row + a rating, return the DB fields to persist after review.
export function schedule(row, rating, now = new Date()) {
  const { card } = f.next(rowToCard(row), now, rating)
  return {
    state: card.state,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    last_review: now.toISOString(),
  }
}
