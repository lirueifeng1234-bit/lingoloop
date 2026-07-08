// Supabase Edge Function: generate-prompt
// Builds ONE speaking prompt tuned to the learner's recent mistakes, so the
// next session naturally makes them re-use the exact structures they slipped on.
// Same Gemini key as analyze-speaking (set once via `supabase secrets set`).

import { callGemini, GeminiError } from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responseSchema = {
  type: 'object',
  properties: {
    scenario: { type: 'string' },
    prompt_text: { type: 'string' },
    focus: { type: 'string' },
    difficulty: { type: 'integer' },
  },
  required: ['scenario', 'prompt_text', 'focus'],
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

    const { errors, recentScenarios } = await req.json()
    const errList = Array.isArray(errors) ? errors : []
    const avoid = Array.isArray(recentScenarios) ? recentScenarios.filter(Boolean) : []

    // Compress the error log into a short, readable brief for the model.
    const errBrief = errList
      .slice(0, 12)
      .map((e: Record<string, unknown>, i: number) => {
        const t = e.error_type ? `[${e.error_type}] ` : ''
        const from = e.original ? `said "${e.original}"` : ''
        const to = e.correction ? ` → better: "${e.correction}"` : ''
        const note = e.note ? ` (${e.note})` : ''
        return `${i + 1}. ${t}${from}${to}${note}`
      })
      .join('\n')

    const instruction = [
      'You design bespoke speaking prompts for an ADVANCED English learner: roughly C1–C2 (TOEIC ~955), first language Chinese, whose explicit goal is native-like, effortless fluency.',
      'Below is a log of their RECENT speaking mistakes and refinements — both outright errors and "correct but not native" phrasings a coach flagged.',
      'Design exactly ONE short speaking task that naturally pushes them to PRODUCE the same kinds of structures, collocations, vocabulary, or register they recently slipped on — giving them a fresh, realistic chance to get it right this time.',
      'Crucial: do NOT mention their mistakes, do NOT make it a grammar drill, and do NOT quote the corrections. It must read as a genuine, engaging real-life situation that simply happens to invite that language.',
      'KEEP IT EVERYDAY: favour ordinary, relatable situations the learner could plausibly run into THIS WEEK — chatting with a friend or colleague, dealing with a landlord/delivery/customer-service issue, catching up over coffee, making weekend plans, telling a small story about your day, giving your honest take on a show or restaurant, sorting out a mix-up with family. Low-stakes and familiar, not exotic. Avoid dramatic set-pieces like courtroom arguments, boardroom negotiations, or press conferences.',
      'Pitch the LANGUAGE at their level even though the situation is everyday: it should still pull for real nuance — an opinion, a feeling, a bit of narration, hedging, or gently talking someone round — not a mechanical transaction. A casual scenario is good; a beginner "order a coffee and read the price" task is not.',
      'HARD REQUIREMENT — VARIETY: the learner strongly dislikes repeated prompts. The SITUATION must feel genuinely new every single time. It is fine (good, even) for the underlying LANGUAGE SKILL it trains to repeat, but the surface scenario, setting, roles, and framing must be clearly different from anything they have seen. Stay within everyday life, but keep finding fresh corners of it.',
      'If the error log is empty, invent a rich, natural scenario for an advanced learner that elicits varied, expressive language.',
      avoid.length
        ? `Do NOT reuse or lightly reskin any of these recently-used prompts — pick something in a different setting entirely:\n${avoid.map((a: string, i: number) => `  - ${a}`).join('\n')}`
        : 'Pick a fresh, non-clichéd situation.',
      '',
      'Return JSON:',
      '- "scenario": a short 2–4 word label (e.g. "Talking a friend out of it", "Explaining a delay at work").',
      '- "prompt_text": the task, addressed to "you", 2–3 sentences, asking for about 4–6 sentences of spoken response. Make the situation vivid and specific.',
      '- "focus": ONE short phrase naming what this prompt is quietly training, shown to the learner (e.g. "past-tense narration + natural connectors", "hedging opinions politely"). Base it on the error log.',
      '- "difficulty": integer 1–5.',
      '',
      'RECENT MISTAKE LOG:',
      errBrief || '(none yet — this is a fresh learner)',
    ].join('\n')

    const body = {
      contents: [{ parts: [{ text: instruction }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.9, // want variety in the situations day to day
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
