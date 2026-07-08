// Supabase Edge Function: generate-reading
// Produces one fresh, authentic-feeling English passage (magazine / news register)
// pitched at C1–C2, plus a glossary of the highest-value words in it.
// Same Gemini key as the other functions (set once via `supabase secrets set`).

import { callGemini, GeminiError, resolveApiKey } from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responseSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    source: { type: 'string' },
    topic: { type: 'string' },
    body: { type: 'string' },
    glossary: {
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
  required: ['title', 'source', 'topic', 'body', 'glossary'],
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
    const { recentTopics, userApiKey } = await req.json().catch(() => ({}))
    const apiKey = resolveApiKey(userApiKey)
    if (!apiKey) return json({ error: 'No Gemini API key — add your own in Settings.' }, 400)
    const avoid = Array.isArray(recentTopics) ? recentTopics.filter(Boolean) : []

    const instruction = [
      'You are a features editor at a serious general-interest magazine (think The Atlantic, The Economist, Aeon, National Geographic). Write ONE short, self-contained reading passage in English for an advanced learner.',
      'The reader is C1–C2 (TOEIC ~955), first language Chinese, and wants to read the way an educated native reads — so this must feel like a REAL published article, not a graded-reader or a textbook exercise. Sophisticated but clear.',
      'Length: about 280–360 words, in 3–5 paragraphs separated by a blank line (\\n\\n). Give it a genuine arc: an intriguing opening, a middle that develops an idea with a concrete detail or example, and a closing thought. No headings, no bullet points, no "In conclusion".',
      'Register and texture: natural journalistic prose with real rhythm — some longer sentences, some short. Use precise, idiomatic vocabulary and a few strong collocations and figurative touches that reward an advanced reader, but never force obscure words in artificially.',
      'Pick a genuinely interesting, specific angle — not a bland encyclopedia summary. Range widely across domains day to day: science, psychology, economics, history, technology, culture, the natural world, language, cities, food, art, ideas.',
      avoid.length
        ? `VARIETY IS REQUIRED. Do NOT write about any of these recently-used topics or anything close to them — choose a clearly different subject and domain:\n${avoid.map((t: string) => `  - ${t}`).join('\n')}`
        : 'Choose a fresh, non-obvious subject.',
      '',
      'Then build a "glossary" of 8–12 items: the most valuable words or short phrases that actually appear in your passage — the ones a C1 reader might pause on, plus strong collocations and idiomatic expressions worth owning. Prefer genuinely useful, transferable vocabulary over rare trivia.',
      'For each glossary item: "word" = the expression as it appears (base/dictionary form is fine, lowercase unless a proper noun); "definition" = a precise one-line meaning IN THE SENSE USED IN THIS PASSAGE, with a register hint if relevant (e.g. "formal", "figurative"); "example" = a NEW natural sentence using it (do not copy the passage sentence).',
      '',
      'Return JSON only:',
      '- "title": a real, evocative headline (not "A Passage About…").',
      '- "source": a short plausible section label, e.g. "Science" or "The long read" — one or two words, no fake bylines or URLs.',
      '- "topic": a 2–4 word label naming the subject (used to avoid repeats).',
      '- "body": the passage text, paragraphs separated by \\n\\n.',
      '- "glossary": the array described above.',
    ].join('\n')

    const body = {
      contents: [{ parts: [{ text: instruction }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.95, // wide topic variety day to day
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

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    let out
    try {
      out = JSON.parse(text)
    } catch {
      return json({ error: 'could not parse model output', raw: text }, 502)
    }

    return json(out, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
