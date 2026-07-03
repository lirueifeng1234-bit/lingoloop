import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [err, setErr] = useState('')

  async function send(e) {
    e.preventDefault()
    setStatus('sending')
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) {
      setStatus('error')
      setErr(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <span className="brand__mark">Lingo<em>Loop</em></span>

        {status === 'sent' ? (
          <>
            <h1 className="auth__title">Check your inbox</h1>
            <p className="auth__sub">
              We sent a sign-in link to <b>{email}</b>. Open it on any device — your
              progress follows the email, not the device.
            </p>
            <button className="auth__link" onClick={() => setStatus('idle')}>
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h1 className="auth__title">Sign in</h1>
            <p className="auth__sub">No password. We’ll email you a one-time link.</p>
            <form className="auth__form" onSubmit={send}>
              <input
                className="auth__input"
                type="email"
                required
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="cta" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending…' : 'Email me a link'}
              </button>
            </form>
            {status === 'error' && <p className="auth__err">{err}</p>}
          </>
        )}
      </div>
    </div>
  )
}
