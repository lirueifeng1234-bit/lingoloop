// Supabase Edge Function: analyze-speaking
// Proxies to Google Gemini (free tier) so the API key never touches the browser.
// Set the key once with:  npx supabase secrets set GEMINI_API_KEY=your_key
//
// The learner's transcript comes in; structured feedback goes out.

import { callGemini, GeminiError } from '../_shared/gemini.ts'

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
      'You are an exacting native-level English coach — think of a sharp CELTA-trained tutor who also happens to be a working writer.',
      'Your learner is ADVANCED: roughly C1–C2 (TOEIC ~955), first language Chinese. Their explicit goal is NATIVE-LIKE, effortless fluency — not passing a test.',
      'Because they are already advanced, do NOT waste their time on basic grammar they clearly control, and never over-praise. Assume they can handle direct, sophisticated feedback and want to be pushed.',
      hasAudio
        ? 'You are given the audio recording. First, transcribe exactly what they said into "transcript" (verbatim best-effort; drop filler like "um"/"uh").'
        : 'Their speech was already transcribed; copy it into "transcript" as given.',
      'Then analyse ONLY their language — grammar, word choice, collocation, idiom, register, and natural phrasing. Ignore pronunciation and background noise.',
      'The real value for an advanced learner is the gap between "correct" and "native". So the "errors" array should hold both actual mistakes AND refinements: phrases that are grammatically fine but that a native speaker would simply not say that way.',
      'Prioritise, in this order: (1) translationese / Chinese-influenced phrasing (word-for-word calques, unnatural collocations, misused connectors); (2) collocation and idiom (the word that natives pair with it, phrasal verbs, set expressions); (3) register and tone (too formal/stiff, too textbook, or mismatched to the situation); (4) precision and economy (a vague or "safe" word where a sharper one exists; wordiness a native would trim); (5) rhythm and discourse (hedges, fillers, and linking that make speech sound native rather than recited).',
      'For each item in "errors": set "error_type" to a short category label (one of: grammar, collocation, idiom, word choice, register, naturalness, wordiness). "original" = exactly what they said; "correction" = the upgraded native version; "note" = a genuinely instructive one- to two-sentence explanation of the nuance — WHY a native prefers it (connotation, formality, what the alternative implies), not just "this is more natural". The note is the whole point; make it teach something.',
      'Aim for 3 to 6 items. If their English is already clean, still surface the best 2–3 refinements that would move them closer to native — there is almost always a more idiomatic phrasing.',
      'For "native_example": rewrite their whole answer the way an articulate, relaxed native speaker would actually say it out loud in this situation — natural, not stiff or inflated.',
      'For "vocab", give 4 to 6 high-value items pitched at C1–C2: idiomatic expressions, phrasal verbs, precise near-synonyms that upgrade a word they used, and strong collocations tied to their refinements and this topic. Skip anything a TOEIC-955 speaker obviously already knows.',
      'Each vocab item needs a precise one-line definition (include register/nuance if relevant, e.g. "informal", "slightly formal") and an "example" sentence showing it in natural use. Items may be single words or short phrases (e.g. "grab a coffee", "cut to the chase").',
      'Keep "overall" to one sharp, honest sentence — name the single biggest thing standing between them and sounding native, not generic encouragement.',
      'If the audio is silent or unintelligible, return an empty transcript and empty errors, and say so plainly in "overall".',
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

    // deno-lint-ignore no-explicit-any
    let data: any
    try {
      ;({ data } = await callGemini(apiKey, body))
    } catch (e) {
      const detail = e instanceof GeminiError ? e.detail : String(e)
      return json({ error: 'gemini request failed', detail }, 502)
    }

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
