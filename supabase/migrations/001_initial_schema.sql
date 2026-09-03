-- ============================================================================
-- ReadWell - Supabase Initial Schema Migration
-- Matches Product Blueprint (Postgres + Auth + Storage)
-- ============================================================================

-- 1. Users Profile Table (linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  age_band TEXT DEFAULT 'adult',
  reading_level TEXT DEFAULT 'intermediate',
  interests JSONB DEFAULT '[]'::jsonb,
  daily_goal_minutes INTEGER DEFAULT 15,
  camera_enabled BOOLEAN DEFAULT FALSE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_current INTEGER DEFAULT 0,
  streak_best INTEGER DEFAULT 0,
  streak_freeze_count INTEGER DEFAULT 0,
  sponsor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Contents / Books Table
CREATE TABLE IF NOT EXISTS public.contents (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  source_type TEXT CHECK (source_type IN ('pdf', 'epub', 'url', 'text', 'gutenberg')) DEFAULT 'text',
  storage_path TEXT,
  language TEXT DEFAULT 'en',
  word_count INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('processing', 'ready', 'failed')) DEFAULT 'ready',
  content_hash TEXT,
  cover_color TEXT DEFAULT '#4F46E5',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Content Segments (Reading chunks)
CREATE TABLE IF NOT EXISTS public.segments (
  id TEXT PRIMARY KEY,
  content_id TEXT REFERENCES public.contents(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  paragraph_start INTEGER NOT NULL,
  paragraph_end INTEGER NOT NULL,
  text_excerpt_hash TEXT,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Quizzes
CREATE TABLE IF NOT EXISTS public.quizzes (
  id TEXT PRIMARY KEY,
  segment_id TEXT REFERENCES public.segments(id) ON DELETE CASCADE,
  model_version TEXT DEFAULT 'gemini-3.6-flash',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  segment_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Reading Sessions (Attendance & Focus Metrics)
CREATE TABLE IF NOT EXISTS public.reading_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content_id TEXT REFERENCES public.contents(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  seconds_read INTEGER NOT NULL DEFAULT 0,
  paragraphs_read INTEGER NOT NULL DEFAULT 0,
  focus_score NUMERIC(5, 2), -- 0..100 computed on device
  distraction_events INTEGER DEFAULT 0,
  device_offline BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Quiz Attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  quiz_id TEXT REFERENCES public.quizzes(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES public.reading_sessions(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL DEFAULT 0, -- 0..5
  free_text_feedback TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User Content Progress
CREATE TABLE IF NOT EXISTS public.user_content_progress (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content_id TEXT REFERENCES public.contents(id) ON DELETE CASCADE,
  last_paragraph INTEGER DEFAULT 0,
  percent_complete NUMERIC(5, 2) DEFAULT 0,
  comprehension_avg NUMERIC(5, 2) DEFAULT 0,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, content_id)
);

-- 8. Daily Activity (Streak & XP tracking)
CREATE TABLE IF NOT EXISTS public.daily_activity (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes_read INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  goal_met BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, date)
);

-- 9. Badges
CREATE TABLE IF NOT EXISTS public.badges (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  badge_id TEXT REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- 10. Ephemeral Messages (24-hour expiration support)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  read BOOLEAN DEFAULT FALSE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_contents_owner ON public.contents(owner_id);
CREATE INDEX IF NOT EXISTS idx_segments_content ON public.segments(content_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_activity_user ON public.daily_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON public.messages(expires_at);

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_content_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id OR auth.uid() = sponsor_id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read own contents" ON public.contents
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Users can read own sessions" ON public.reading_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own attempts" ON public.quiz_attempts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own progress" ON public.user_content_progress
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read own daily activity" ON public.daily_activity
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Participants can view messages" ON public.messages
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
