-- ═══════════════════════════════════════════════════════════════════════════
-- ADHD Tracker — Supabase SQL Migration
-- Run this in your Supabase SQL Editor: https://app.supabase.com/
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enable UUID extension ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tasks table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'personal'
                    CHECK (category IN ('exam','assignment','habit','personal','lecture')),
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('high','medium','low')),
  energy_required   TEXT NOT NULL DEFAULT 'medium'
                    CHECK (energy_required IN ('high','medium','low')),
  estimated_minutes INTEGER DEFAULT 25,
  completed         BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at      TIMESTAMPTZ,
  due_date          TIMESTAMPTZ,
  scheduled_time    TEXT,           -- HH:MM string
  steps             JSONB DEFAULT '[]'::jsonb,
  "order"           INTEGER DEFAULT 0,
  source            TEXT DEFAULT 'manual'
                    CHECK (source IN ('manual','ical','ai')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Timer logs table (time-blindness training) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.timer_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id             UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  category            TEXT,
  estimated_minutes   INTEGER NOT NULL,
  actual_minutes      INTEGER NOT NULL,
  logged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Brain dumps table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brain_dumps (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── User settings table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme              TEXT DEFAULT 'dark',
  energy_level       TEXT DEFAULT 'medium',
  calendar_mode      TEXT DEFAULT 'jalali',
  ical_urls          JSONB DEFAULT '[]'::jsonb,
  focus_duration     INTEGER DEFAULT 25,
  short_break        INTEGER DEFAULT 5,
  long_break         INTEGER DEFAULT 15,
  sound_enabled      BOOLEAN DEFAULT TRUE,
  notifications      BOOLEAN DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS) — users can only see their own data
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timer_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_dumps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings  ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE POLICY "tasks_own" ON public.tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Timer logs
CREATE POLICY "timer_logs_own" ON public.timer_logs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Brain dumps
CREATE POLICY "brain_dumps_own" ON public.brain_dumps
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Settings
CREATE POLICY "settings_own" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes for performance
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS tasks_user_id_idx      ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx     ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_order_idx        ON public.tasks("order");
CREATE INDEX IF NOT EXISTS tasks_completed_idx    ON public.tasks(completed);
CREATE INDEX IF NOT EXISTS timer_logs_user_id_idx ON public.timer_logs(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Auto-update updated_at trigger
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════
-- Done! Your ADHD Tracker schema is ready.
-- Next: Go to Authentication > Settings and configure email auth.
-- ═══════════════════════════════════════════════════════════════════════════
