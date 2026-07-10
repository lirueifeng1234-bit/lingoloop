import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Email + password sign-in.
//
// We moved off magic links on purpose: once the app is added to the iPhone home
// screen it runs as its own standalone app, but a magic link tapped in Gmail
// opens in Safari — a SEPARATE login context — so the installed app never got
// signed in. Password sign-in happens entirely inside the app, and Supabase
// persists the session (localStorage) with auto-refresh, so you stay signed in
// across launches and don't have to log in every time.

export default function Login() {
  const [mode, setMode] = useState('in') // 'in' = sign in | 'up' = create account
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setNotice('')

    const creds = { email: email.trim(), password }
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword(creds)
      // On success, the auth listener flips the app into the signed-in view.
      if (error) setErr(friendly(error.message))
    } else {
      const { data, error } = await supabase.auth.signUp(creds)
      if (error) {
        setErr(friendly(error.message))
      } else if (!data.session) {
        // Email confirmation is still switched on in Supabase — no instant
        // session. Point them at it, but the smoother setup is to turn it off.
        setNotice('Account created. Check your email to confirm, then sign in.')
        setMode('in')
      }
      // If data.session exists, the listener signs them straight in.
    }
    setBusy(false)
  }

  const isUp = mode === 'up'

  return (
    <div className="auth">
      <div className="auth__card">
        <div className="auth__brand">
          <img
            className="auth__logo"
            src={`${import.meta.env.BASE_URL}icon-192.png`}
            alt=""
            width="60"
            height="60"
          />
          <span className="brand__mark">Lingo<em>Loop</em></span>
        </div>

        <h1 className="auth__title">{isUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth__sub">
          {isUp
            ? 'Pick an email and password. You stay signed in on this device — no links, no re-logging in.'
            : 'Sign in with your email and password.'}
        </p>

        <form className="auth__form" onSubmit={submit}>
          <input
            className="auth__input"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="auth__pwrow">
            <input
              className="auth__input"
              type={reveal ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={isUp ? 'new-password' : 'current-password'}
              placeholder={isUp ? 'New password (6+ chars)' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth__peek"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? 'Hide password' : 'Show password'}
            >
              {reveal ? 'Hide' : 'Show'}
            </button>
          </div>
          <button className="cta" type="submit" disabled={busy}>
            {busy ? 'Just a moment…' : isUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {err && <p className="auth__err">{err}</p>}
        {notice && <p className="auth__notice">{notice}</p>}

        <button
          className="auth__link"
          onClick={() => { setMode(isUp ? 'in' : 'up'); setErr(''); setNotice('') }}
        >
          {isUp ? 'Already have an account? Sign in' : 'First time here? Create an account'}
        </button>
      </div>
    </div>
  )
}

// Turn Supabase's terse auth errors into something a person can act on.
function friendly(msg) {
  const m = String(msg || '').toLowerCase()
  if (m.includes('invalid login')) return 'Wrong email or password. Try again, or create an account.'
  if (m.includes('already registered')) return 'That email already has an account — switch to Sign in.'
  if (m.includes('password should be')) return 'Password needs to be at least 6 characters.'
  if (m.includes('email not confirmed')) return 'This email isn’t confirmed yet — check your inbox for the confirmation link.'
  return msg
}
