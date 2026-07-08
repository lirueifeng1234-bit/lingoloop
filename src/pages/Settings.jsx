/*
 * Settings — where each user plugs in their OWN Gemini API key.
 * The key is stored only in this browser (localStorage, via lib/apiKey), never
 * sent to our database and never committed. Every AI call then spends that
 * user's own free-tier quota. With no key set, the app falls back to the
 * built-in shared key, so the owner needs no setup at all.
 */
import { useState } from 'react'
import { getUserKey, setUserKey, hasUserKey } from '../lib/apiKey'

// Show a key as its first/last few chars only — enough to recognise, never the
// whole secret on screen.
function mask(k) {
  if (!k) return ''
  if (k.length <= 10) return '••••••'
  return `${k.slice(0, 4)}••••••${k.slice(-4)}`
}

export default function Settings({ email, onExit }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(hasUserKey())
  const [reveal, setReveal] = useState(false)
  const [flash, setFlash] = useState('')

  const stored = getUserKey()

  function save() {
    const v = value.trim()
    if (!v) return
    setUserKey(v)
    setSaved(true)
    setValue('')
    setFlash('Saved — this device now uses your own key.')
    setTimeout(() => setFlash(''), 2600)
  }

  function remove() {
    setUserKey('')
    setSaved(false)
    setValue('')
    setFlash('Removed. Falling back to the built-in key.')
    setTimeout(() => setFlash(''), 2600)
  }

  return (
    <div className="reading">
      <div className="speak__bar">
        <button className="review__back" onClick={onExit}>← Today</button>
        <span className="review__progress mono">Settings</span>
      </div>

      <div className="settings">
        <h1 className="settings__title">Your Gemini key</h1>
        <p className="settings__sub">
          Signed in as <b>{email}</b>. Everything you practise is private to this
          account. Add your own Google Gemini key so every correction, prompt and
          lookup runs on <b>your</b> free quota — not shared with anyone.
        </p>

        <div className={`settings__status ${saved ? 'is-own' : 'is-shared'}`}>
          {saved ? (
            <>
              <span className="settings__dot" aria-hidden="true" />
              Using your own key <code className="settings__mask">{mask(stored)}</code>
            </>
          ) : (
            <>
              <span className="settings__dot" aria-hidden="true" />
              Using the built-in shared key — add your own below to use your quota.
            </>
          )}
        </div>

        <label className="settings__label" htmlFor="gk">
          {saved ? 'Replace your key' : 'Paste your key'}
        </label>
        <div className="settings__row">
          <input
            id="gk"
            className="settings__input mono"
            type={reveal ? 'text' : 'password'}
            placeholder="AIza…"
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save() }}
          />
          <button
            type="button"
            className="settings__peek"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide key' : 'Show key'}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="settings__actions">
          <button className="cta settings__save" onClick={save} disabled={!value.trim()}>
            Save key
          </button>
          {saved && (
            <button className="settings__remove" onClick={remove}>Remove</button>
          )}
        </div>

        {flash && <p className="settings__flash">{flash}</p>}

        <div className="settings__help">
          <p>
            <b>Where do I get one?</b> Go to{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>
            , sign in with your Google account, and click <b>Create API key</b>. The
            free tier is enough for daily practice — no card, no charge.
          </p>
          <p className="settings__note">
            Your key is stored only in this browser and is cleared when you sign
            out. It’s never saved to the database or shared with other users.
          </p>
        </div>
      </div>
    </div>
  )
}
