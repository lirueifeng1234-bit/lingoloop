// Shared Gemini caller with a free-tier model fallback chain.
//
// Goal: squeeze every free tier we can. Each call walks the model list from
// best to most-forgiving. If the best model is out of quota (429) or the
// server is overloaded (5xx), we drop to the next one and keep going. Because
// every call re-starts at the top of the list, the moment a model's quota
// resets it is used again automatically — no stored state, no manual switch.
//
// Used by all four edge functions (analyze-speaking, generate-prompt,
// generate-reading, lookup-word) via `import { callGemini } from '../_shared/gemini.ts'`.

// Best → most-forgiving free quota. 2.5-pro is the sharpest but has the
// smallest free allowance; flash-lite has the largest. So we prefer quality
// and degrade gracefully as each tier runs dry.
// (Deliberately NOT including gemini-2.0-flash — on newer keys its free quota
// is 0, so it just 429s. Add it back if a key actually has quota for it.)
export const GEMINI_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]

// Model -> epoch ms until which we treat it as exhausted. Lives at module
// scope, so it survives only while the function instance stays warm (best
// effort). On a cold start it's empty and we happily try the best model first.
const cooldownUntil: Record<string, number> = {}
const isExhausted = (m: string) => (cooldownUntil[m] ?? 0) > Date.now()

export interface GeminiResult {
  // Raw Gemini generateContent response.
  data: unknown
  // Which model actually answered (handy for logging / debugging).
  model: string
}

export class GeminiError extends Error {
  status: number
  detail: string
  constructor(message: string, status: number, detail: string) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
    this.detail = detail
  }
}

// How long to skip a model after it fails. Rate limits (RPM) reset in ~60s;
// daily limits are longer, but a short cooldown keeps us responsive the moment
// quota frees up. Honour Gemini's own RetryInfo hint when it sends one.
function cooldownMs(status: number, detail: string): number {
  if (status >= 500) return 30_000 // transient overload — retry soon
  const m = detail.match(/"retryDelay":\s*"(\d+)s"/)
  if (m) return (Number(m[1]) + 1) * 1000
  return 5 * 60_000 // 429 with no hint: back off a few minutes
}

/**
 * POST `body` to Gemini, trying each model in `models` (default: the full
 * best→worst free chain) until one succeeds. Throws GeminiError if they all
 * fail or the request itself is rejected (non-429 4xx).
 */
export async function callGemini(
  apiKey: string,
  body: unknown,
  models: string[] = GEMINI_MODELS,
): Promise<GeminiResult> {
  // Fresh (not-on-cooldown) models first; still keep exhausted ones as a
  // last-ditch fallback in case their quota reset earlier than we guessed.
  const ordered = [...models.filter((m) => !isExhausted(m)), ...models.filter(isExhausted)]

  let lastStatus = 0
  let lastDetail = 'no models attempted'

  for (const model of ordered) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    let r: Response
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (e) {
      // Network hiccup — not this model's fault; try the next one.
      lastStatus = 0
      lastDetail = String(e)
      continue
    }

    if (r.ok) {
      delete cooldownUntil[model] // it's alive again
      return { data: await r.json(), model }
    }

    lastStatus = r.status
    lastDetail = await r.text()

    // 429 = out of quota / rate-limited; 5xx = overloaded. Either way another
    // model might work — put this one on cooldown and move on.
    if (r.status === 429 || r.status >= 500) {
      cooldownUntil[model] = Date.now() + cooldownMs(r.status, lastDetail)
      continue
    }

    // Any other 4xx (e.g. 400 bad request) means the request itself is wrong;
    // a different model won't fix it, so fail fast.
    break
  }

  throw new GeminiError(
    `all Gemini models failed (last status ${lastStatus})`,
    lastStatus,
    lastDetail,
  )
}
