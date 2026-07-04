// Supabase Edge Function: lookup-word
// Instant, in-context dictionary lookup for a word tapped in the reading passage.
// Returns the sense actually used in the sentence, plus a fresh example — shaped
// to slot straight into the vocabulary deck (definition + example).
// Same Gemini key as the other functions.

const MODEL = 'gemini-2.5-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responseSchema = {
  type: 'object',
  properties: {
    word: { type: 'string' },
    pos: { type: 'string' },
    definition: { type: 'string' },
    example: { type: 'string' },
  },
  required: ['word', 'definition', 'example'],
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

    const { word, context } = await req.json()
    if (!word || !String(word).trim()) return json({ error: 'no word provided' }, 400)

    const instruction = [
      'You are a precise English dictionary for an advanced learner (C1–C2, first language Chinese). Define ONE word/expression exactly as it is used in the sentence given.',
      'Return the meaning that fits THIS context (word sense disambiguation), not a generic list of every sense.',
      '"word": the base/dictionary form (lemma) of the expression, lowercase unless a proper noun.',
      '"pos": short part of speech (e.g. "noun", "verb", "adjective", "phrase"). If it is an idiom or phrasal verb, use "phrase".',
      '"definition": one crisp line in plain English, pitched at C1–C2 — precise, not childish. Add a brief register or nuance hint in parentheses if it matters (e.g. "(formal)", "(figurative)").',
      '"example": one natural example sentence using the word in the same sense — DIFFERENT from the sentence provided.',
      'Be fast and concise. Do not add commentary outside the JSON fields.',
      '',
      `WORD: ${word}`,
      `SENTENCE IT APPEARED IN: ${context ?? '(none given — define its most common sense)'}`,
    ].join('\n')

    const body = {
      contents: [{ parts: [{ text: instruction }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.3,
      },
    }

    const r = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!r.ok) {
      const detail = await r.text()
      return json({ error: 'gemini request failed', detail }, 502)
    }

    const data = await r.json()
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
