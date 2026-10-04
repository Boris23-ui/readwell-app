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

function getSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase admin not configured');
  return supabase;
}

export class CoachMemoryBank {
  async getProfile(userId: string): Promise<CoachProfile> {
    const defaultProfile: CoachProfile = {
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
    
    // Fallback to default if no database profile exists yet (for Coach features)
    return defaultProfile;
  }

  async saveProfile(profile: CoachProfile): Promise<void> {
    // Left unimplemented intentionally as the main user profile
    // is currently updated directly from the app using Supabase client.
    // The coach reads from `coach_strategies`, not a dedicated coach_profiles table.
  }

  async getStrategy(userId: string): Promise<StrategyDoc> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('coach_strategies')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { ...DEFAULT_STRATEGY };
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
  }

  async saveStrategy(userId: string, strategy: StrategyDoc): Promise<void> {
    const supabase = getSupabase();
    
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
  }

  async getTranscripts(userId: string, limit = 10): Promise<TranscriptTurn[]> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('coach_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit * 2);

    if (error || !data) return [];
    
    // Group by timestamp (user + assistant pairs)
    // Note: this assumes a simplified structure to match TranscriptTurn
    const turns: TranscriptTurn[] = [];
    const grouped = new Map<string, any[]>();
    for (const row of data) {
      if (!grouped.has(row.timestamp)) grouped.set(row.timestamp, []);
      grouped.get(row.timestamp)!.push(row);
    }
    
    for (const [ts, rows] of grouped) {
      const user = rows.find(r => r.role === 'user');
      const assistant = rows.find(r => r.role === 'assistant');
      
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
    
    return turns.reverse(); // Ascending
  }

  async saveTranscript(userId: string, turn: TranscriptTurn): Promise<void> {
    const supabase = getSupabase();
    
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
  }

  async getFlashcards(userId: string): Promise<Flashcard[]> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('coach_flashcards')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];

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
  }

  async saveFlashcard(userId: string, card: Flashcard): Promise<void> {
    const supabase = getSupabase();
    
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
  }

  async getReadingPlans(userId: string): Promise<ReadingPlan[]> {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('coach_plans')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      bookTitle: d.book_title,
      totalChapters: d.total_chapters,
      targetDays: d.target_days,
      chaptersPerDay: d.pace?.chaptersPerDay ?? Math.ceil(d.total_chapters / Math.max(1, d.target_days)),
      estimatedMinutesPerSession: d.pace?.estimatedMinutesPerSession ?? 20,
      feasible: d.pace?.feasible ?? true,
      schedule: d.items ?? [],
      createdAt: d.created_at,
    }));
  }

  async saveReadingPlan(userId: string, plan: ReadingPlan): Promise<void> {
    const supabase = getSupabase();
    
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
  }
}

export const coachMemory = new CoachMemoryBank();
