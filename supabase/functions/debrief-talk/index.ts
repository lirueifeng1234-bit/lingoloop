// Supabase Edge Function: debrief-talk
// The learner pastes their whole voice-mode conversation transcript; a strong
// text model (not the lazy voice model) writes the real coaching debrief:
// every upgrade with the why, the register, and a usage example — shaped so
// the app can bank it straight into the review deck and the weak-spots log.
//
// Key handling matches every other function: caller's own key wins, the
// built-in server key is owner-only (see _shared/gemini.ts).

import { callGemini, GeminiError, getCallerEmail, resolveApiKey } from '../_shared/gemini.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responseSchema = {
  type: 'object',
  properties: {
    overall: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    upgrades: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          you_said: { type: 'string' },
          native: { type: 'string' },
          why: { type: 'string' },
          use_when: { type: 'string' },
          example: { type: 'string' },
        },
        required: ['you_said', 'native', 'why', 'use_when', 'example'],
      },
    },
    new_expressions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phrase: { type: 'string' },
          meaning: { type: 'string' },
          use_when: { type: 'string' },
          example: { type: 'string' },
        },
        required: ['phrase', 'meaning', 'use_when', 'example'],
      },
    },
    pronunciation: {
      type: 'array',
      items: {
        type: 'object',
        properties: { word: { type: 'string' }, tip: { type: 'string' } },
        required: ['word', 'tip'],
      },
    },
    fluency: { type: 'string' },
  },
  required: ['overall', 'strengths', 'upgrades', 'new_expressions', 'pronunciation', 'fluency'],
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
    const { transcript, sessionTitle, personaName, userApiKey } = await req.json()
    const apiKey = resolveApiKey(userApiKey, getCallerEmail(req))
    if (!apiKey) return json({ error: 'No Gemini API key — add your own in Settings.' }, 400)
    if (!transcript || !String(transcript).trim()) {
      return json({ error: 'no transcript provided' }, 400)
    }

    const instruction = [
      'You are a superb native-level English coach debriefing a spoken practice session. Think: a sharp, warm CELTA-trained tutor who is also a working writer — direct, specific, never gushing.',
      'Below is the transcript of a VOICE conversation between an AI conversation partner' + (personaName ? ` (in character as "${personaName}")` : '') + ' and my learner. The learner is the human participant — the non-native speaker being coached. Identify their turns even if the transcript has no speaker labels: they are the one making learner-style slips, being corrected, and doing most of the answering.',
      'The learner is ADVANCED (C1–C2, first language Chinese, TOEIC ~955). Their goal is effortless, native-sounding English. Do not waste their time on grammar they clearly control, and never over-praise.',
      'Analyze ONLY the learner\'s language. The partner\'s lines are context.',
      '',
      'For "upgrades" — the heart of this debrief, aim for 5 to 8 items. The real value is the gap between "correct" and "native": include actual mistakes AND phrasings that were grammatically fine but that a native simply would not say that way. Prioritize, in order: (1) translationese / Chinese-influenced phrasing; (2) collocation and idiom — the word natives actually pair with it, phrasal verbs, set expressions; (3) register and tone — too stiff, too textbook, mismatched to the moment; (4) precision and economy — a vague or "safe" word where a sharper one exists, wordiness a native would trim; (5) rhythm and discourse — hedges, linking, and openers that make speech sound native rather than recited.',
      'For each upgrade: "you_said" = their words, quoted exactly from the transcript (trim to the relevant phrase). "native" = the upgraded version an articulate, relaxed native would actually say out loud — casual register unless the scene demanded formal, and nothing that smells of a textbook or a corporate memo. "why" = one or two sentences that genuinely teach the nuance — WHY a native prefers it: connotation, what the original accidentally implies, the collocation at work. This field is the whole point; make it teach. "use_when" = when and where this phrasing fits — situation and register, plus any caution (too casual for a client call, British vs American, etc.). "example" = one natural sentence using it in a DIFFERENT situation than the conversation, so they see its range.',
      'If the learner spoke very little, still mine everything they did say — there is almost always a more idiomatic phrasing.',
      '',
      'For "new_expressions": 2 to 4 high-value expressions they did NOT use but that fit this conversation\'s territory — idioms, phrasal verbs, or precise near-synonyms pitched at C1–C2. Skip anything an advanced learner obviously knows. Same fields: meaning (one line, include register), use_when, example.',
      'For "pronunciation": ONLY what the transcript itself shows — words the partner flagged or spelled out, or places the learner was clearly misheard. For each, give the fix with the stress spelled out (like "comfortable → KUMF-tuh-bul"). If the transcript shows nothing, return an empty array — do not invent.',
      'For "fluency": the single most valuable thing to practice before the next session, based on their hesitation patterns, restarts, or repeated safe structures. One concrete sentence, with a ready-made chunk to practice if that fits.',
      'For "strengths": 1 to 3 things they genuinely did well, each pointing at a specific moment or phrase from the transcript. Specific observation, not praise — "your recovery after the interruption — rephrasing instead of restarting — is exactly what natives do" beats "great job".',
      'For "overall": two or three honest sentences. Name the single biggest thing standing between them and sounding native right now, and the trendline if you can see one. No generic encouragement.',
      'If the paste contains no real learner conversation (empty, or not a transcript), return empty arrays and say so plainly in "overall".',
      '',
      sessionTitle ? `TODAY'S SESSION WAS: ${sessionTitle}` : '',
      'TRANSCRIPT:',
      String(transcript).slice(0, 60000),
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

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    let debrief
    try {
      debrief = JSON.parse(text)
    } catch {
      return json({ error: 'model returned malformed debrief' }, 502)
    }

    return json(debrief, 200)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
