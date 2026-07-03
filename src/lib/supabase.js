import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// These two are meant to be public (frontend-safe). Real protection comes from
// Row Level Security policies on each table — see supabase/migrations.
if (!url || !anonKey) {
  console.warn(
    '[LingoLoop] Supabase env vars missing. Copy .env.example to .env and fill in your keys.',
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '')
