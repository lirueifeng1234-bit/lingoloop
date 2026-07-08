// The day's speaking prompt. Shared by the home card and the speaking page so
// they always show the same task. Later these can be Gemini-generated and
// stored in the speaking_prompts table, tuned to the learner's recurring errors.
export const PROMPTS = [
  { scenario: 'Catching up', text: 'You bump into a friend you haven’t seen in months. Tell them what you’ve actually been up to — the good and the annoying — in 4–6 sentences, and ask about them.' },
  { scenario: 'Talking them into it', text: 'A friend’s dithering about whether to come to a weekend thing. Gently talk them round: acknowledge their excuse, then give them two reasons it’s worth it.' },
  { scenario: 'Your honest take', text: 'Someone asks if a show or restaurant you tried recently is worth it. Give your real verdict in 4–6 sentences — what worked, what didn’t, who’d like it.' },
  { scenario: 'The small mix-up', text: 'A delivery or booking got messed up. Explain to the company what happened, stay civil, and say exactly what you’d like them to do about it.' },
  { scenario: 'How your week went', text: 'A colleague asks how things are going. Tell the story of one thing that went sideways this week — set it up, land the frustrating bit, and how it ended.' },
]

// Same prompt for the whole calendar day, rotating day to day.
export function pickPrompt() {
  const day = Math.floor(Date.now() / 86400000)
  return PROMPTS[day % PROMPTS.length]
}

export const SPEAKING_MINUTES = 8
export const VOCAB_MINUTES = 5
