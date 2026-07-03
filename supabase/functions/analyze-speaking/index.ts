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
    transcript: { type: 'string' },
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
        required: ['word', 'definition', 'example'],
      },
    },
  },
  required: ['transcript', 'errors', 'native_example', 'vocab'],
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

    const { prompt, audioBase64, mimeType, transcript } = await req.json()
    const hasAudio = audioBase64 && String(audioBase64).length > 0
    const hasText = transcript && String(transcript).trim()
    if (!hasAudio && !hasText) {
      return json({ error: 'no audio or transcript provided' }, 400)
    }

    const instruction = [
      'You are a warm, precise English speaking coach.',
      'A learner (intermediate; first language Chinese) was given a speaking prompt and answered OUT LOUD.',
      hasAudio
        ? 'You are given the audio recording. First, transcribe exactly what they said into "transcript" (verbatim best-effort; drop filler like "um"/"uh").'
        : 'Their speech was already transcribed; copy it into "transcript" as given.',
      'Then analyse ONLY their language — grammar, word choice, and natural phrasing. Ignore pronunciation and background noise.',
      'Find real errors. For each: the original phrase, a short correction, and a one-line note on why.',
      'Give one natural, native-sounding way to express what they meant (native_example).',
      'For "vocab", give 4 to 6 items to study: include useful words the learner actually used, AND — tied to their errors and this topic — related vocabulary, collocations, and natural expressions that would let them say this better next time.',
      'Each vocab item needs a clear one-line definition and an "example" sentence that shows the word/expression in natural use. Items may be single words or short phrases (e.g. "grab a coffee"). Skip trivial words.',
      'Keep "overall" to one encouraging sentence.',
      'If the audio is silent or unintelligible, return an empty transcript and empty errors, and say so kindly in "overall".',
      '',
      `PROMPT: ${prompt ?? '(none)'}`,
      hasAudio ? '' : `LEARNER SAID: ${transcript}`,
    ].join('\n')

    const parts: unknown[] = [{ text: instruction }]
    if (hasAudio) {
      parts.push({ inlineData: { mimeType: mimeType || 'audio/wav', data: audioBase64 } })
    }

    const body = {
      contents: [{ parts }],
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
      analysis = { transcript: '', errors: [], native_example: '', vocab: [], raw: text }
    }

    return json(analysis, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
