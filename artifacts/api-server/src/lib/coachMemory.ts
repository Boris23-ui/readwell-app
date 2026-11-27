import { logger } from './logger';
import { getSupabaseAdmin } from './supabase';

export interface BookProgress {
  bookId: string;
  title: string;
  author: string;
  currentChapter: number;
  totalChapters: number;
  targetFinishDate?: string | null;
  keyTakeaways?: string[];
  themesExplored?: string[];
  startedAt: string;
  status: 'active' | 'completed' | 'abandoned';
}

export interface ReadingStreak {
  currentStreak: number;
  longestStreak: number;
  lastReadDate: string;
  totalSessions: number;
  totalMinutes: number;
}

export interface EngagementSignal {
  timestamp: string;
  signalType: 'response_length' | 'confusion' | 'enthusiasm' | 'disengagement' | 'breakthrough';
  value: string;
  context?: string;
}

export interface CoachProfile {
  userId: string;
  name: string;
  readingGoals: string[];
  preferredDifficulty: 'easy' | 'medium' | 'hard';
  availableMinutesPerDay: number;
  activeBooks: BookProgress[];
  completedBooks: BookProgress[];
  vocabularyBank: string[];
  engagementSignals: EngagementSignal[];
  streak: ReadingStreak;
  lastActive: string;
  onboarded: boolean;
}

export interface EvolutionRecord {
  version: number;
  timestamp: string;
  observation: string;
  adjustmentMade: string;
  expectedImpact: string;
  actualImpact?: string;
}

export interface StrategyDoc {
  version: number;
  lastUpdated: string;
  tone: string;
  difficultyLevel: number;
  preferredQuestionStyle: string;
  effectiveTactics: string[];
  ineffectiveTactics: string[];
  sessionPace: string;
  evolutionHistory: EvolutionRecord[];
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  bookTitle: string;
  chapter: number;
  cardType: 'vocabulary' | 'concept' | 'theme' | 'quote';
  createdAt: string;
  nextReview: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface TranscriptTurn {
  timestamp: string;
  userMessage: string;
  agentResponse: string;
  agentName: string;
  intent?: string;
  strategyVersion?: number;
  bookContext?: any;
}

export interface ReadingPlanItem {
  day: number;
  date: string;
  chapters: string;
  milestone: boolean;
}

export interface ReadingPlan {
  id?: string;
  userId?: string;
  bookTitle: string;
  totalChapters: number;
  targetDays: number;
  chaptersPerDay: number;
  estimatedMinutesPerSession: number;
  feasible: boolean;
  schedule: ReadingPlanItem[];
  createdAt?: string;
}

export const DEFAULT_STRATEGY: StrategyDoc = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  tone: 'Encouraging, intellectual, Socratic',
  difficultyLevel: 0.5,
  preferredQuestionStyle: 'Open-ended Socratic with personal reflection',
  effectiveTactics: [
    'Connect themes across books',
    'Use real-world analogies for abstract concepts',
    'Ask about personal relevance',
  ],
  ineffectiveTactics: [
    'Pop-quiz factual interrogation',
    'Long summaries before questions',
  ],
  sessionPace: '10-15 minute check-ins',
  evolutionHistory: [],
};

const MAX_IN_MEMORY_USERS = 200;

function isGuestUserId(userId: string): boolean {
  return userId.startsWith('guest:');
}

function getCloudSupabase(userId: string) {
  if (isGuestUserId(userId)) return null;
  return getSupabaseAdmin();
}

function setBounded<K, V>(map: Map<K, V>, key: K, value: V) {
  if (!map.has(key) && map.size >= MAX_IN_MEMORY_USERS) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

function makeDefaultProfile(userId: string): CoachProfile {
  return {
    userId,
    name: 'Reader',
    readingGoals: ['Build consistent reading habit', 'Deepen comprehension'],
    preferredDifficulty: 'medium',
    availableMinutesPerDay: 20,
    activeBooks: [],
    completedBooks: [],
    vocabularyBank: [],
    engagementSignals: [],
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      lastReadDate: '',
      totalSessions: 0,
      totalMinutes: 0,
    },
    lastActive: new Date().toISOString(),
    onboarded: false,
  };
}

export class CoachMemoryBank {
  private memProfiles = new Map<string, CoachProfile>();
  private memStrategies = new Map<string, StrategyDoc>();
  private memTranscripts = new Map<string, TranscriptTurn[]>();
  private memFlashcards = new Map<string, Flashcard[]>();
  private memPlans = new Map<string, ReadingPlan[]>();

  async getProfile(userId: string): Promise<CoachProfile> {
    const cached = this.memProfiles.get(userId);
    const base: CoachProfile = cached
      ? {
          ...cached,
          engagementSignals: [...cached.engagementSignals],
          activeBooks: [...cached.activeBooks],
          completedBooks: [...cached.completedBooks],
          streak: { ...cached.streak },
        }
      : makeDefaultProfile(userId);

    const supabase = getCloudSupabase(userId);
    if (!supabase) {
      return base;
    }

    try {
      const [userRes, contentsRes, dailyRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('contents').select('*').eq('owner_id', userId).limit(10),
        supabase
          .from('daily_activity')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })
          .limit(30),
      ]);

      if (userRes.data && !userRes.error) {
        const u = userRes.data as any;
        base.name = u.display_name || base.name;
        base.availableMinutesPerDay = u.daily_goal_minutes ?? base.availableMinutesPerDay;
        base.preferredDifficulty =
          u.reading_level === 'beginner'
            ? 'easy'
            : u.reading_level === 'advanced'
            ? 'hard'
            : 'medium';
        base.streak.currentStreak = u.streak_current ?? base.streak.currentStreak;
        base.streak.longestStreak = u.streak_best ?? base.streak.longestStreak;
        base.onboarded = true;
        if (!cached && u.updated_at) {
          base.lastActive = u.updated_at;
        }
      }

      if (Array.isArray(contentsRes.data) && !contentsRes.error) {
        base.activeBooks = contentsRes.data.map((c: any) => ({
          bookId: c.id,
          title: c.title || 'Untitled',
          author: c.author || 'Unknown',
          currentChapter: 1,
          totalChapters: Math.max(1, Math.ceil((c.word_count || 500) / 500)),
          startedAt: c.created_at || new Date().toISOString(),
          status: 'active',
        }));
      }

      if (Array.isArray(dailyRes.data) && !dailyRes.error && dailyRes.data.length > 0) {
        const latest = dailyRes.data[0] as any;
        if (latest?.date) {
          base.streak.lastReadDate = latest.date;
          if (!cached) {
            base.lastActive = new Date(`${latest.date}T12:00:00Z`).toISOString();
          }
        }
        base.streak.totalMinutes = dailyRes.data.reduce(
          (sum: number, row: any) => sum + (Number(row.minutes_read) || 0),
          0,
        );
        base.streak.totalSessions = dailyRes.data.length;
      }
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: Failed to hydrate profile from Supabase; using cached/default');
    }

    return base;
  }

  async saveProfile(profile: CoachProfile): Promise<void> {
    setBounded(this.memProfiles, profile.userId, {
      ...profile,
      engagementSignals: profile.engagementSignals.slice(-50),
    });
  }

  async getStrategy(userId: string): Promise<StrategyDoc> {
    const supabase = getCloudSupabase(userId);
    if (!supabase) {
      const mem = this.memStrategies.get(userId);
      return mem
        ? {
            ...mem,
            effectiveTactics: [...mem.effectiveTactics],
            ineffectiveTactics: [...mem.ineffectiveTactics],
            evolutionHistory: [...mem.evolutionHistory],
          }
        : { ...DEFAULT_STRATEGY, evolutionHistory: [] };
    }

    try {
      const { data, error } = await supabase
        .from('coach_strategies')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        const mem = this.memStrategies.get(userId);
        return mem ? { ...mem } : { ...DEFAULT_STRATEGY, evolutionHistory: [] };
      }

      return {
        version: data.version ?? DEFAULT_STRATEGY.version,
        lastUpdated: data.last_updated ?? DEFAULT_STRATEGY.lastUpdated,
        tone: data.tone ?? DEFAULT_STRATEGY.tone,
        difficultyLevel: data.difficulty_level ?? DEFAULT_STRATEGY.difficultyLevel,
        preferredQuestionStyle: data.preferred_question_style ?? DEFAULT_STRATEGY.preferredQuestionStyle,
        effectiveTactics: data.effective_tactics ?? DEFAULT_STRATEGY.effectiveTactics,
        ineffectiveTactics: data.ineffective_tactics ?? DEFAULT_STRATEGY.ineffectiveTactics,
        sessionPace: data.session_pace ?? DEFAULT_STRATEGY.sessionPace,
        evolutionHistory: data.evolution_history ?? DEFAULT_STRATEGY.evolutionHistory,
      };
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: getStrategy fallback to memory');
      return this.memStrategies.get(userId) ?? { ...DEFAULT_STRATEGY, evolutionHistory: [] };
    }
  }

  async saveStrategy(userId: string, strategy: StrategyDoc): Promise<void> {
    setBounded(this.memStrategies, userId, {
      ...strategy,
      evolutionHistory: [...strategy.evolutionHistory],
    });

    const supabase = getCloudSupabase(userId);
    if (!supabase) return;

    try {
      await supabase.from('coach_strategies').upsert({
        user_id: userId,
        version: strategy.version,
        last_updated: strategy.lastUpdated || new Date().toISOString(),
        tone: strategy.tone,
        difficulty_level: strategy.difficultyLevel,
        preferred_question_style: strategy.preferredQuestionStyle,
        effective_tactics: strategy.effectiveTactics,
        ineffective_tactics: strategy.ineffectiveTactics,
        session_pace: strategy.sessionPace,
        evolution_history: strategy.evolutionHistory,
      });
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: saveStrategy cloud write failed (kept in memory)');
    }
  }

  async getTranscripts(userId: string, limit = 10): Promise<TranscriptTurn[]> {
    const supabase = getCloudSupabase(userId);
    if (!supabase) {
      const list = this.memTranscripts.get(userId) ?? [];
      return list.slice(-limit);
    }

    try {
      const { data, error } = await supabase
        .from('coach_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit * 2);

      if (error || !data) {
        return (this.memTranscripts.get(userId) ?? []).slice(-limit);
      }

      const turns: TranscriptTurn[] = [];
      const grouped = new Map<string, any[]>();
      for (const row of data) {
        if (!grouped.has(row.timestamp)) grouped.set(row.timestamp, []);
        grouped.get(row.timestamp)!.push(row);
      }

      for (const [ts, rows] of grouped) {
        const user = rows.find((r) => r.role === 'user');
        const assistant = rows.find((r) => r.role === 'assistant');

        if (user || assistant) {
          turns.push({
            timestamp: ts,
            userMessage: user?.content || '',
            agentResponse: assistant?.content || '',
            agentName: assistant?.agent_name || 'Coach',
            intent: assistant?.intent || user?.intent,
            strategyVersion: assistant?.strategy_version || user?.strategy_version,
            bookContext: assistant?.book_context || user?.book_context,
          });
        }
      }

      return turns.reverse();
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: getTranscripts fallback to memory');
      return (this.memTranscripts.get(userId) ?? []).slice(-limit);
    }
  }

  async saveTranscript(userId: string, turn: TranscriptTurn): Promise<void> {
    const existing = this.memTranscripts.get(userId) ?? [];
    setBounded(this.memTranscripts, userId, [...existing.slice(-49), turn]);

    const supabase = getCloudSupabase(userId);
    if (!supabase) return;

    try {
      await supabase.from('coach_conversations').insert([
        {
          id: `conv_u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          role: 'user',
          content: turn.userMessage,
          timestamp: turn.timestamp,
          strategy_version: turn.strategyVersion,
          agent_name: turn.agentName,
          intent: turn.intent,
          book_context: turn.bookContext,
        },
        {
          id: `conv_a_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          role: 'assistant',
          content: turn.agentResponse,
          timestamp: turn.timestamp,
          strategy_version: turn.strategyVersion,
          agent_name: turn.agentName,
          intent: turn.intent,
          book_context: turn.bookContext,
        },
      ]);
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: saveTranscript cloud write failed (kept in memory)');
    }
  }

  async getFlashcards(userId: string): Promise<Flashcard[]> {
    const supabase = getCloudSupabase(userId);
    if (!supabase) {
      return [...(this.memFlashcards.get(userId) ?? [])];
    }

    try {
      const { data, error } = await supabase
        .from('coach_flashcards')
        .select('*')
        .eq('user_id', userId);

      if (error || !data) {
        return [...(this.memFlashcards.get(userId) ?? [])];
      }

      return data.map((d: any) => ({
        id: d.id,
        front: d.front,
        back: d.back,
        bookTitle: d.book_title,
        chapter: d.chapter,
        cardType: d.card_type,
        createdAt: d.created_at,
        nextReview: d.next_review,
        intervalDays: d.interval_days,
        easeFactor: d.ease_factor,
        repetitions: d.repetitions,
      }));
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: getFlashcards fallback to memory');
      return [...(this.memFlashcards.get(userId) ?? [])];
    }
  }

  async saveFlashcard(userId: string, card: Flashcard): Promise<void> {
    const existing = this.memFlashcards.get(userId) ?? [];
    const idx = existing.findIndex((c) => c.id === card.id);
    const updated =
      idx >= 0
        ? existing.map((c, i) => (i === idx ? card : c))
        : [...existing, card];
    setBounded(this.memFlashcards, userId, updated);

    const supabase = getCloudSupabase(userId);
    if (!supabase) return;

    try {
      await supabase.from('coach_flashcards').upsert({
        id: card.id,
        user_id: userId,
        front: card.front,
        back: card.back,
        book_title: card.bookTitle,
        chapter: card.chapter,
        card_type: card.cardType,
        created_at: card.createdAt,
        next_review: card.nextReview,
        interval_days: card.intervalDays,
        ease_factor: card.easeFactor,
        repetitions: card.repetitions,
      });
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: saveFlashcard cloud write failed (kept in memory)');
    }
  }

  async getReadingPlans(userId: string): Promise<ReadingPlan[]> {
    const supabase = getCloudSupabase(userId);
    if (!supabase) {
      return [...(this.memPlans.get(userId) ?? [])];
    }

    try {
      const { data, error } = await supabase
        .from('coach_plans')
        .select('*')
        .eq('user_id', userId);

      if (error || !data) {
        return [...(this.memPlans.get(userId) ?? [])];
      }

      return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        bookTitle: d.book_title,
        totalChapters: d.total_chapters,
        targetDays: d.target_days,
        chaptersPerDay:
          d.pace?.chaptersPerDay ?? Math.ceil(d.total_chapters / Math.max(1, d.target_days)),
        estimatedMinutesPerSession: d.pace?.estimatedMinutesPerSession ?? 20,
        feasible: d.pace?.feasible ?? true,
        schedule: d.items ?? [],
        createdAt: d.created_at,
      }));
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: getReadingPlans fallback to memory');
      return [...(this.memPlans.get(userId) ?? [])];
    }
  }

  async saveReadingPlan(userId: string, plan: ReadingPlan): Promise<void> {
    const existing = this.memPlans.get(userId) ?? [];
    setBounded(this.memPlans, userId, [...existing.slice(-9), plan]);

    const supabase = getCloudSupabase(userId);
    if (!supabase) return;

    try {
      await supabase.from('coach_plans').upsert({
        id: plan.id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId,
        book_title: plan.bookTitle,
        total_chapters: plan.totalChapters,
        target_days: plan.targetDays,
        pace: {
          chaptersPerDay: plan.chaptersPerDay,
          estimatedMinutesPerSession: plan.estimatedMinutesPerSession,
          feasible: plan.feasible,
        },
        items: plan.schedule,
        created_at: plan.createdAt || new Date().toISOString(),
      });
    } catch (err) {
      logger.warn({ err, userId }, 'CoachMemory: saveReadingPlan cloud write failed (kept in memory)');
    }
  }
}

export const coachMemory = new CoachMemoryBank();
