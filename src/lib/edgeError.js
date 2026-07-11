// Turn a failed `supabase.functions.invoke()` result into the clearest,
// most actionable message we can show the learner.
//
// Why this exists: when an edge function replies with a non-2xx status,
// supabase-js sets `error` (a FunctionsHttpError) and leaves `data` as null —
// so the `{ error, detail }` body our functions carefully return (e.g. "No
// Gemini API key — add your own in Settings.", or Gemini's own quota message)
// is invisible to `data?.error`. The real body is on `error.context`, an
// unread Response. We read it back here so users see the actual reason instead
// of a blank "service unreachable", which is what made this impossible to
// diagnose in the first place.

const GENERIC = 'The analysis service isn’t reachable right now. Please try again in a moment.'

// Gemini's error bodies look like {"error":{"code":429,"message":"…","status":"…"}}.
// Our edge function forwards that whole JSON string as `detail`; pull the human
// sentence out of it when we can.
function pullGeminiMessage(detail) {
  if (!detail) return ''
  try {
    const j = JSON.parse(detail)
    return j?.error?.message || detail
  } catch {
    return String(detail)
  }
}

async function readPayload(error, data) {
  // 200 responses that still carry an app-level error land in `data`.
  if (data && (data.error || data.detail)) return data
  const ctx = error?.context
  if (ctx && typeof ctx.json === 'function') {
    try { return await ctx.json() } catch { /* body wasn't JSON — fall through */ }
  }
  if (ctx && typeof ctx.text === 'function') {
    try {
      const t = await ctx.text()
      if (t) return { error: t }
    } catch { /* ignore */ }
  }
  return null
}

// Returns { message, needsKey }. `needsKey` is true when the server told us the
// caller has no usable Gemini key (or it's invalid), so callers can steer the
// user to Settings.
export async function analyzeErrorInfo(error, data) {
  const p = await readPayload(error, data)
  if (!p) return { message: GENERIC, needsKey: false }

  const errText = typeof p.error === 'string' ? p.error : ''
  const gm = pullGeminiMessage(p.detail)
  const blob = `${errText} ${gm}`.toLowerCase()

  // Our own guard, or Gemini rejecting the key: this is a key problem the user
  // fixes in Settings, not a transient outage.
  const keyProblem =
    /no gemini api key/.test(blob) ||
    /api[_ ]?key not valid/.test(blob) ||
    /api key expired/.test(blob) ||
    /invalid api key/.test(blob) ||
    /permission denied/.test(blob)

  if (keyProblem) {
    return {
      message:
        errText && /add your own/i.test(errText)
          ? errText // already actionable: "No Gemini API key — add your own in Settings."
          : 'Your Gemini API key was rejected. Open Settings and paste a valid key.',
      needsKey: true,
    }
  }

  if (gm) return { message: `Analysis failed — ${gm}`, needsKey: false }
  if (errText) return { message: `Analysis failed — ${errText}`, needsKey: false }
  return { message: GENERIC, needsKey: false }
}
