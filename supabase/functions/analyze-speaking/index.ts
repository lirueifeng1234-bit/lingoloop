// Supabase Edge Function: analyze-speaking
// Proxies to Google Gemini (free tier) so the API key never touches the browser.
// Set the key once with:  npx supabase secrets set GEMINI_API_KEY=your_key
//
// The learner's transcript comes in; structured feedback goes out.

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
        required: ['error_type', 'original', 'correction'],
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
        required: ['word', 'definition'],
      },
    },
  },
  required: ['errors', 'native_example', 'vocab'],
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

    const { prompt, transcript } = await req.json()
    if (!transcript || !String(transcript).trim()) {
      return json({ error: 'empty transcript' }, 400)
    }

    const instruction = [
      'You are a warm, precise English speaking coach.',
      'A learner (intermediate; first language Chinese) was given a speaking prompt and answered out loud; their speech was transcribed.',
      'Analyse ONLY their language — ignore transcription artefacts and punctuation.',
      'Find real grammar and word-choice errors. For each: a short correction and a one-line note on why.',
      'Give one natural, native-sounding way to express what they meant (native_example).',
      'Suggest up to 4 genuinely useful vocabulary items worth learning from this (skip trivial words).',
      'Keep "overall" to one encouraging sentence.',
      '',
      `PROMPT: ${prompt ?? '(none)'}`,
      `LEARNER SAID: ${transcript}`,
    ].join('\n')

    const body = {
      contents: [{ parts: [{ text: instruction }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.4,
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
    let analysis
    try {
      analysis = JSON.parse(text)
    } catch {
      analysis = { errors: [], native_example: '', vocab: [], raw: text }
    }

    return json(analysis, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
