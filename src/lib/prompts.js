// The day's speaking prompt. Shared by the home card and the speaking page so
// they always show the same task. Later these can be Gemini-generated and
// stored in the speaking_prompts table, tuned to the learner's recurring errors.
export const PROMPTS = [
  { scenario: 'Ordering at a café', text: 'You’re at a café. Order a drink and a snack, ask one question about the menu, and change your mind once.' },
  { scenario: 'Small talk', text: 'A colleague asks how your weekend was. Answer in 3–4 sentences, then ask them back.' },
  { scenario: 'Explaining your work', text: 'Explain what you do for a living to someone you just met — in plain English.' },
  { scenario: 'Giving directions', text: 'Tell a tourist how to get from here to the nearest train station.' },
  { scenario: 'Making a complaint', text: 'An online order arrived damaged. Politely explain the problem and say what you’d like done.' },
]

// Same prompt for the whole calendar day, rotating day to day.
export function pickPrompt() {
  const day = Math.floor(Date.now() / 86400000)
  return PROMPTS[day % PROMPTS.length]
}

export const SPEAKING_MINUTES = 8
export const VOCAB_MINUTES = 5
