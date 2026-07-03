import { useCallback, useEffect, useState } from 'react'
import { useSession } from './hooks/useSession'
import { supabase } from './lib/supabase'
import { ensureStarterDeck, getDueCount, getStreak } from './lib/db'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Review from './pages/Review.jsx'
import Speaking from './pages/Speaking.jsx'

export default function App() {
  const session = useSession()
  const [view, setView] = useState('home') // 'home' | 'review'
  const [stats, setStats] = useState({ dueCount: null, streak: null })

  const userId = session?.user?.id

  const refresh = useCallback(async () => {
    if (!userId) return
    try {
      await ensureStarterDeck(userId)
      const [dueCount, streak] = await Promise.all([getDueCount(), getStreak()])
      setStats({ dueCount, streak })
    } catch (e) {
      console.error('[LingoLoop] failed to load stats', e)
    }
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  if (session === undefined) return <div className="boot">Loading…</div>
  if (session === null) return <Login />

  if (view === 'review') {
    return <Review userId={userId} onExit={() => { setView('home'); refresh() }} />
  }
  if (view === 'speaking') {
    return <Speaking userId={userId} onExit={() => { setView('home'); refresh() }} />
  }

  return (
    <Home
      stats={stats}
      email={session.user?.email}
      onStartSpeaking={() => setView('speaking')}
      onStartVocab={() => setView('review')}
      onSignOut={() => supabase.auth.signOut()}
    />
  )
}
