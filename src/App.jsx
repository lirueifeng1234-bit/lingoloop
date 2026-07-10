import { useCallback, useEffect, useState } from 'react'
import { useSession } from './hooks/useSession'
import { useLivingGradient } from './hooks/useLivingGradient'
import { supabase } from './lib/supabase'
import { ensureStarterDeck, getDueCount, getStreak, getTodayProgress, getWeekActivity, resolveTodayPrompt } from './lib/db'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Review from './pages/Review.jsx'
import Speaking from './pages/Speaking.jsx'
import Reading from './pages/Reading.jsx'
import Writing from './pages/Writing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Settings from './pages/Settings.jsx'
import { clearUserKey } from './lib/apiKey'

export default function App() {
  useLivingGradient() // ambient pointer-reactive gradient on every screen
  const session = useSession()
  const [view, setView] = useState('home') // 'home' | 'review'
  const [stats, setStats] = useState({ dueCount: null, streak: null, progress: null, week: null })
  const [prompt, setPrompt] = useState(null) // today's speaking prompt (dynamic)

  const userId = session?.user?.id

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      await ensureStarterDeck(userId)
      const [dueCount, streak, progress, week] = await Promise.all([
        getDueCount(),
        getStreak(),
        getTodayProgress(),
        getWeekActivity(),
      ])
      setStats({ dueCount, streak, progress, week })
    } catch (e) {
      console.error('[LingoLoop] failed to load stats', e)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  // Resolve today's prompt once (cached in DB for the day), separate from stats
  // so a slow Gemini call never holds up the rest of the home screen.
  useEffect(() => {
    if (!userId) return
    let alive = true
    resolveTodayPrompt(userId)
      .then((p) => { if (alive) setPrompt(p) })
      .catch((e) => console.error('[LingoLoop] failed to load prompt', e))
    return () => { alive = false }
  }, [userId])

  if (session === undefined) return <div className="boot">Loading…</div>
  if (session === null) return <Login />

  if (view === 'review') {
    return <Review userId={userId} onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'speaking') {
    return <Speaking userId={userId} prompt={prompt} onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'reading') {
    return <Reading userId={userId} onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'writing') {
    return <Writing userId={userId} onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'dashboard') {
    return <Dashboard onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'settings') {
    return <Settings email={session.user?.email} onExit={() => { setView('home'); refresh() }} />
  }

  return (
    <Home
      stats={stats}
      prompt={prompt}
      email={session.user?.email}
      onStartSpeaking={() => setView('speaking')}
      onStartVocab={() => setView('review')}
      onStartReading={() => setView('reading')}
      onStartWriting={() => setView('writing')}
      onOpenProgress={() => setView('dashboard')}
      onOpenSettings={() => setView('settings')}
      onSignOut={() => { clearUserKey(); supabase.auth.signOut() }}
    />
  )
}
