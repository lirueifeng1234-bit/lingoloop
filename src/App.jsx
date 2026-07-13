import { useCallback, useEffect, useState } from 'react'
import { useSession } from './hooks/useSession'
import { useLivingGradient } from './hooks/useLivingGradient'
import { supabase } from './lib/supabase'
import { ensureStarterDeck, getDueCount, getStreak, getTodayProgress, getWeekActivity } from './lib/db'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Review from './pages/Review.jsx'
import Speak from './pages/Speak.jsx'
import Reading from './pages/Reading.jsx'
import Writing from './pages/Writing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Settings from './pages/Settings.jsx'
import Collection from './pages/Collection.jsx'
import { clearUserKey } from './lib/apiKey'

export default function App() {
  useLivingGradient() // ambient pointer-reactive gradient on every screen
  const session = useSession()
  const [view, setView] = useState('home') // 'home' | 'review'
  const [stats, setStats] = useState({ dueCount: null, streak: null, progress: null, week: null })

  const userId = session?.user?.id

  const refresh = useCallback(async () => {
    if (!userId) return
    // Starter deck is best-effort: a hiccup here must never block the stats
    // below, or the home numbers freeze on whatever they showed last.
    try { await ensureStarterDeck(userId) } catch (e) { console.error('[LingoLoop] starter deck check failed', e) }
    try {
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

  // As an installed PWA the app resumes from memory rather than reloading, so
  // nothing above would re-run — home could show yesterday's numbers all day.
  // Re-fetch stats whenever the app comes back to the foreground; the refresh
  // re-renders Home, which re-derives today's session/keepsake from the date.
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== 'visible') return
      refresh()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [refresh])

  if (session === undefined) return <div className="boot">Loading…</div>
  if (session === null) return <Login />

  if (view === 'review') {
    return <Review userId={userId} onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'speaking') {
    return <Speak userId={userId} email={session?.user?.email} onExit={() => { setView('home'); refresh() }} />
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
  if (view === 'collection') {
    return <Collection onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'settings') {
    return <Settings email={session.user?.email} onExit={() => { setView('home'); refresh() }} />
  }

  return (
    <Home
      stats={stats}
      email={session.user?.email}
      onStartSpeaking={() => setView('speaking')}
      onStartVocab={() => setView('review')}
      onStartReading={() => setView('reading')}
      onStartWriting={() => setView('writing')}
      onOpenCollection={() => setView('collection')}
      onOpenProgress={() => setView('dashboard')}
      onOpenSettings={() => setView('settings')}
      onSignOut={() => { clearUserKey(); supabase.auth.signOut() }}
    />
  )
}
