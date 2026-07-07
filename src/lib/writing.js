// The day's writing task. Shared by the home card and the writing page so they
// always show the same prompt. Writing is the "write" of listen/speak/read/write:
// unlike speaking (spoken naturalness), it's judged on register, cohesion, and
// structure — so the prompts lean on real written formats (emails, reviews,
// arguments) with a clear audience and purpose to react to.
export const WRITING_PROMPTS = [
  {
    scenario: 'The awkward reply',
    text: 'A colleague you barely know has asked you to cover their shift this weekend — the third time this month. Write a short reply that says no without burning the bridge.',
    focus: 'polite refusal · hedging · warm-but-firm register',
  },
  {
    scenario: 'A review worth reading',
    text: 'Write a 4–6 sentence review of a film, book, or restaurant you have strong feelings about. Make someone either seek it out or steer clear — no fence-sitting.',
    focus: 'evaluative language · vivid specifics · a clear verdict',
  },
  {
    scenario: 'The case for',
    text: 'Your team is split on a decision (remote vs. office, a tool, a hire — your call). Write a short, persuasive note arguing one side to a boss who is short on time.',
    focus: 'argument structure · concession then rebuttal · concision',
  },
  {
    scenario: 'Something that happened',
    text: 'Tell the story of a small thing that recently went wrong — a missed train, a mix-up, a misunderstanding. Make it land in five or six sentences.',
    focus: 'narrative tenses · natural connectors · pacing',
  },
  {
    scenario: 'The gentle complaint',
    text: 'A service you pay for has quietly gotten worse. Write to them: name the problem clearly, stay civil, and say exactly what you want done.',
    focus: 'diplomatic tone · precise asks · formal register',
  },
  {
    scenario: 'Explain it plainly',
    text: 'Explain something from your own field or hobby to an intelligent friend who knows nothing about it — in one tight paragraph, no jargon.',
    focus: 'clarity · analogy · trimming the technical',
  },
]

// Same prompt for the whole calendar day, rotating day to day. Offset from the
// speaking rotation so the two daily tasks rarely echo each other.
export function pickWritingPrompt() {
  const day = Math.floor(Date.now() / 86400000)
  return WRITING_PROMPTS[(day + 2) % WRITING_PROMPTS.length]
}

export const WRITING_MINUTES = 7
