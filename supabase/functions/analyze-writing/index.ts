// Supabase Edge Function: analyze-writing
// The learner's written draft comes in; structured, native-level feedback goes
// out. Same Gemini key as the other functions (set once via `supabase secrets
// set GEMINI_API_KEY=...`). Judged as WRITING — register, cohesion, structure,
// punctuation, written idiom — not as transcribed speech.

import { callGemini, GeminiError } from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responseSchema = {
  type: 'object',
  properties: {
    overall: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          error_type: { type: 'string' },
          original: { type: 'string' },
          correction: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['error_type', 'original', 'correction', 'note'],
      },
    },
    native_example: { type: 'string' },
    vocab: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          definition: { type: 'string' },
          example: { type: 'string' },
        },
        required: ['word', 'definition', 'example'],
      },
    },
  },
  required: ['overall', 'errors', 'native_example', 'vocab'],
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return json({ error: 'GEMINI_API_KEY not set on the server' }, 500)

    const { prompt, text } = await req.json()
    const draft = typeof text === 'string' ? text.trim() : ''
    if (!draft) return json({ error: 'no writing submitted' }, 400)

    const instruction = [
      'You are an exacting native-level English writing coach — think of a sharp editor at a good magazine who also trained as a CELTA tutor.',
      'Your learner is ADVANCED: roughly C1–C2 (TOEIC ~955), first language Chinese. Their explicit goal is NATIVE-LIKE, effortless written English — prose that reads as if a well-read native wrote it, not a test answer.',
      'Because they are already advanced, do NOT waste their time on basic grammar they clearly control, and never over-praise. Assume they can handle direct, sophisticated editing and want to be pushed.',
      'Judge this as WRITING, not speech. That means the bar is different from a conversation: cohesion between sentences, paragraph shape, punctuation, sentence-length variety, and register consistency all matter here, on top of word choice.',
      'The real value for an advanced learner is the gap between "correct" and "native/well-written". So the "errors" array should hold both actual mistakes AND refinements: phrasing that is grammatically fine but that a strong native writer would revise.',
      'Prioritise, in this order: (1) translationese / Chinese-influenced phrasing (word-for-word calques, unnatural collocations, misused connectors); (2) cohesion & flow (clunky transitions, sentences that don\'t link, given/new information order, a missing or buried topic sentence); (3) register & tone (mismatched to the task — too stiff for a casual note, too breezy for a complaint; textbook formality); (4) collocation & idiom (the word or preposition natives actually pair with it; set expressions); (5) precision & economy (a vague or "safe" word where a sharper one exists; wordiness and filler a good editor would cut); (6) mechanics that hurt written English specifically (comma splices, run-ons, punctuation, awkward sentence rhythm).',
      'For each item in "errors": set "error_type" to a short category label (one of: grammar, collocation, idiom, word choice, register, cohesion, wordiness, punctuation, naturalness). "original" = the exact phrase or sentence from their draft; "correction" = the upgraded native version; "note" = a genuinely instructive one- to two-sentence explanation of the nuance — WHY a native writer prefers it (connotation, formality, what the alternative implies, how it reads), not just "this is more natural". The note is the whole point; make it teach something.',
      'Aim for 3 to 6 items. If the writing is already clean, still surface the best 2–3 refinements that would move it closer to polished native prose — there is almost always a sharper phrasing or a smoother join.',
      'For "native_example": rewrite their WHOLE piece the way a skilled native writer would, keeping their intent, content, and roughly their length — a model they can compare against sentence by sentence. Match the register the task calls for; do not inflate it into something stiffer or fancier than the situation wants.',
      'For "vocab", give 4 to 6 high-value items pitched at C1–C2: idiomatic expressions, precise near-synonyms that upgrade a word they used, strong collocations, and useful connectors/discourse markers tied to their refinements and this task. Skip anything a TOEIC-955 writer obviously already knows.',
      'Each vocab item needs a precise one-line definition (include register/nuance if relevant, e.g. "formal", "slightly informal") and an "example" sentence showing it in natural written use. Items may be single words or short phrases (e.g. "on balance", "give or take", "take issue with").',
      'Keep "overall" to one sharp, honest sentence — name the single biggest thing standing between this draft and polished native writing, not generic encouragement.',
      'If the submission is empty, off-task, or gibberish, return empty errors and empty vocab and say so plainly in "overall".',
      '',
      `TASK THEY WERE WRITING TO: ${prompt ?? '(none given)'}`,
      '',
      'THEIR DRAFT:',
      draft,
    ].join('\n')

    const body = {
      contents: [{ parts: [{ text: instruction }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.4,
      },
    }

    // deno-lint-ignore no-explicit-any
    let data: any
    try {
      ;({ data } = await callGemini(apiKey, body))
    } catch (e) {
      const detail = e instanceof GeminiError ? e.detail : String(e)
      return json({ error: 'gemini request failed', detail }, 502)
    }

    const modelText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    let analysis
    try {
      analysis = JSON.parse(modelText)
    } catch {
      analysis = { overall: '', errors: [], native_example: '', vocab: [], raw: modelText }
    }

    return json(analysis, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
