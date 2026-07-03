-- LingoLoop · initial schema (v0.1)
-- Single source of truth: every session, error, and word lives here.
-- Run this in the Supabase SQL editor (or via the Supabase CLI).

-- ============================================================
-- practice_sessions — metadata for every practice session
-- ============================================================
create table if not exists public.practice_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  skill_type   text not null check (skill_type in ('speaking', 'vocab', 'reading', 'writing')),
  duration_sec integer not null default 0,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- speaking_prompts — prompt library
-- user_id null = shared/global prompt; otherwise a user-generated one
-- ============================================================
create table if not exists public.speaking_prompts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete cascade,
  scenario    text not null,
  prompt_text text not null,
  difficulty  smallint not null default 2 check (difficulty between 1 and 5),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- errors — cross-skill error log (the connective tissue)
-- ============================================================
create table if not exists public.errors (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  error_type    text not null,                       -- e.g. 'past_tense', 'article', 'word_choice'
  original      text not null,
  correction    text not null,
  note          text,                                -- more natural / native phrasing
  source_module text not null check (source_module in ('speaking', 'reading', 'writing', 'vocab')),
  session_id    uuid references public.practice_sessions (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- vocabulary — word bank with FSRS scheduling fields
-- ============================================================
create table if not exists public.vocabulary (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  word        text not null,
  definition  text,
  example     text,
  source      text,                                  -- 'speaking' | 'reading' | 'manual'
  -- FSRS state
  state       smallint not null default 0,           -- 0 new, 1 learning, 2 review, 3 relearning
  due         timestamptz not null default now(),
  stability   real not null default 0,
  difficulty  real not null default 0,
  reps        integer not null default 0,
  lapses      integer not null default 0,
  last_review timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, word)
);

create index if not exists idx_vocab_due on public.vocabulary (user_id, due);
create index if not exists idx_errors_created on public.errors (user_id, created_at desc);
create index if not exists idx_sessions_created on public.practice_sessions (user_id, created_at desc);

-- ============================================================
-- Row Level Security — each user can only touch their own rows
-- ============================================================
alter table public.practice_sessions enable row level security;
alter table public.speaking_prompts  enable row level security;
alter table public.errors            enable row level security;
alter table public.vocabulary        enable row level security;

create policy "own rows" on public.practice_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.errors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on public.vocabulary
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- speaking_prompts: anyone can read shared prompts or their own; write only their own
create policy "read shared or own" on public.speaking_prompts
  for select using (user_id is null or auth.uid() = user_id);
create policy "insert own" on public.speaking_prompts
  for insert with check (auth.uid() = user_id);
create policy "update own" on public.speaking_prompts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.speaking_prompts
  for delete using (auth.uid() = user_id);
