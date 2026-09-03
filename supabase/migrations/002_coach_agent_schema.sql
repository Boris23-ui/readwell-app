-- ============================================================================
-- ReadWell - Supabase Coach Agent Schema Migration
-- Matches multi-agent Socratic reader companion & evolution engine
-- ============================================================================

-- 1. Coach Strategies (Self-Evolving Pedagogical Profile)
CREATE TABLE IF NOT EXISTS public.coach_strategies (
  user_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tone TEXT NOT NULL DEFAULT 'Encouraging, intellectual, Socratic',
  difficulty_level DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  preferred_question_style TEXT NOT NULL DEFAULT 'Open-ended Socratic with personal reflection',
  effective_tactics JSONB NOT NULL DEFAULT '["Connect themes across books", "Real-world analogies", "Personal reflection hooks"]'::jsonb,
  ineffective_tactics JSONB NOT NULL DEFAULT '["Pop-quiz interrogation", "Long lectures"]'::jsonb,
  session_pace TEXT NOT NULL DEFAULT '10-15 minute check-ins',
  evolution_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Coach Flashcards (SM-2 Spaced Repetition)
CREATE TABLE IF NOT EXISTS public.coach_flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  book_title TEXT NOT NULL DEFAULT 'General',
  chapter INTEGER NOT NULL DEFAULT 1,
  card_type TEXT NOT NULL DEFAULT 'concept',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_review TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  repetitions INTEGER NOT NULL DEFAULT 0
);

-- 3. Coach Conversations (Socratic Multi-turn transcripts)
CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  strategy_version INTEGER,
  agent_name TEXT,
  intent TEXT,
  book_context JSONB
);

-- 4. Coach Reading Plans
CREATE TABLE IF NOT EXISTS public.coach_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  book_title TEXT NOT NULL,
  total_chapters INTEGER NOT NULL,
  target_days INTEGER NOT NULL,
  pace JSONB,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_coach_flashcards_user ON public.coach_flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_flashcards_next_review ON public.coach_flashcards(next_review);
CREATE INDEX IF NOT EXISTS idx_coach_conversations_user ON public.coach_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_plans_user ON public.coach_plans(user_id);

-- Row Level Security
ALTER TABLE public.coach_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own coach strategies" ON public.coach_strategies
  FOR ALL USING (auth.uid()::text = user_id OR user_id = 'default_reader' OR auth.role() = 'service_role');

CREATE POLICY "Users can manage own coach flashcards" ON public.coach_flashcards
  FOR ALL USING (auth.uid()::text = user_id OR user_id = 'default_reader' OR auth.role() = 'service_role');

CREATE POLICY "Users can manage own coach conversations" ON public.coach_conversations
  FOR ALL USING (auth.uid()::text = user_id OR user_id = 'default_reader' OR auth.role() = 'service_role');

CREATE POLICY "Users can manage own coach plans" ON public.coach_plans
  FOR ALL USING (auth.uid()::text = user_id OR user_id = 'default_reader' OR auth.role() = 'service_role');
