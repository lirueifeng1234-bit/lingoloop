// Per-user Gemini API key.
//
// Each person pastes their own key on the Settings page; it lives ONLY in this
// browser (localStorage) — it never touches our database, never gets committed,
// and is cleared on sign-out. It rides along on every Gemini edge-function call
// so each user spends their own free-tier quota against their own Google
// account. If a user hasn't set one, the request omits it and the server falls
// back to its built-in key (so the owner keeps working with zero setup).

const KEY = 'll_gemini_key'

// The one account that may use the app's built-in Gemini key. Everyone else
// must add their own on the Settings page before they can practise — mirrors the
// server-side rule in supabase/functions/_shared/gemini.ts (OWNER_EMAIL).
export const OWNER_EMAIL = 'lirueifeng1234@gmail.com'

export function isOwner(email) {
  return String(email || '').trim().toLowerCase() === OWNER_EMAIL
}

// True when this signed-in user still needs to add their own key: they aren't
// the owner and haven't saved one yet. The whole app should nudge them to
// Settings until this clears.
export function needsOwnKey(email) {
  return !isOwner(email) && !hasUserKey()
}

export function getUserKey() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}

export function setUserKey(k) {
  try {
    const v = String(k || '').trim()
    if (v) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

export function clearUserKey() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function hasUserKey() {
  return !!getUserKey()
}

// Merge the caller's key into an edge-function request body. Omitted entirely
// when there's no key, so the server-side fallback stays in charge.
export function withUserKey(body = {}) {
  const k = getUserKey()
  return k ? { ...body, userApiKey: k } : body
}
