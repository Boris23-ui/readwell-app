import fs from 'fs';
import path from 'path';
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

export class CoachMemoryBank {
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.resolve(process.cwd(), 'data_store');
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      logger.warn({ err }, 'Could not create data_store directory, memory will operate in-memory fallback');
    }
  }

  private getFilePath(userId: string, category: string): string {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dataDir, `coach_${safeUserId}_${category}.json`);
  }

  private readJson<T>(filePath: string, defaultVal: T): T {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      logger.warn({ err, filePath }, 'Failed to read coach JSON file, using default');
    }
    return defaultVal;
  }

  private writeJson<T>(filePath: string, data: T): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error({ err, filePath }, 'Failed to write coach JSON file');
    }
  }

  async getProfile(userId: string): Promise<CoachProfile> {
    const filePath = this.getFilePath(userId, 'profile');
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
    return this.readJson<CoachProfile>(filePath, defaultProfile);
  }

  async saveProfile(profile: CoachProfile): Promise<void> {
    const filePath = this.getFilePath(profile.userId, 'profile');
    this.writeJson(filePath, profile);
  }

  async getStrategy(userId: string): Promise<StrategyDoc> {
    const filePath = this.getFilePath(userId, 'strategy');
    const local = this.readJson<StrategyDoc>(filePath, { ...DEFAULT_STRATEGY });

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('coach_strategies')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (data && !error) {
          const remoteStrategy: StrategyDoc = {
            version: data.version ?? local.version,
            lastUpdated: data.last_updated ?? local.lastUpdated,
            tone: data.tone ?? local.tone,
            difficultyLevel: data.difficulty_level ?? local.difficultyLevel,
            preferredQuestionStyle: data.preferred_question_style ?? local.preferredQuestionStyle,
            effectiveTactics: data.effective_tactics ?? local.effectiveTactics,
            ineffectiveTactics: data.ineffective_tactics ?? local.ineffectiveTactics,
            sessionPace: data.session_pace ?? local.sessionPace,
            evolutionHistory: data.evolution_history ?? local.evolutionHistory,
          };
          this.writeJson(filePath, remoteStrategy);
          return remoteStrategy;
        }
      } catch (err) {
        logger.debug({ err, userId }, 'Supabase getStrategy query fallback to local');
      }
    }
    return local;
  }

  async saveStrategy(userId: string, strategy: StrategyDoc): Promise<void> {
    const filePath = this.getFilePath(userId, 'strategy');
    this.writeJson(filePath, strategy);

    const supabase = getSupabaseAdmin();
    if (supabase) {
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
        logger.debug({ err, userId }, 'Supabase saveStrategy upsert error');
      }
    }
  }

  async getTranscripts(userId: string, limit = 10): Promise<TranscriptTurn[]> {
    const filePath = this.getFilePath(userId, 'transcripts');
    const local = this.readJson<TranscriptTurn[]>(filePath, []);
    return limit > 0 ? local.slice(-limit) : local;
  }

  async saveTranscript(userId: string, turn: TranscriptTurn): Promise<void> {
    const filePath = this.getFilePath(userId, 'transcripts');
    const list = this.readJson<TranscriptTurn[]>(filePath, []);
    list.push(turn);
    const trimmed = list.slice(-200);
    this.writeJson(filePath, trimmed);

    const supabase = getSupabaseAdmin();
    if (supabase) {
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
        logger.debug({ err, userId }, 'Supabase saveTranscript insert error');
      }
    }
  }

  async getFlashcards(userId: string): Promise<Flashcard[]> {
    const filePath = this.getFilePath(userId, 'flashcards');
    const local = this.readJson<Flashcard[]>(filePath, []);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('coach_flashcards')
          .select('*')
          .eq('user_id', userId);

        if (data && !error && data.length > 0) {
          const remoteCards: Flashcard[] = data.map((d: any) => ({
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
          this.writeJson(filePath, remoteCards);
          return remoteCards;
        }
      } catch (err) {
        logger.debug({ err, userId }, 'Supabase getFlashcards fallback to local');
      }
    }
    return local;
  }

  async saveFlashcard(userId: string, card: Flashcard): Promise<void> {
    const filePath = this.getFilePath(userId, 'flashcards');
    const list = this.readJson<Flashcard[]>(filePath, []);
    const idx = list.findIndex(c => c.id === card.id || c.front.toLowerCase() === card.front.toLowerCase());
    if (idx >= 0) {
      list[idx] = card;
    } else {
      list.push(card);
    }
    this.writeJson(filePath, list);

    const supabase = getSupabaseAdmin();
    if (supabase) {
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
        logger.debug({ err, userId }, 'Supabase saveFlashcard upsert error');
      }
    }
  }

  async getReadingPlans(userId: string): Promise<ReadingPlan[]> {
    const filePath = this.getFilePath(userId, 'plans');
    const local = this.readJson<ReadingPlan[]>(filePath, []);

    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('coach_plans')
          .select('*')
          .eq('user_id', userId);

        if (data && !error && data.length > 0) {
          const remotePlans: ReadingPlan[] = data.map((d: any) => ({
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
          return remotePlans;
        }
      } catch (err) {
        logger.debug({ err, userId }, 'Supabase getReadingPlans fallback to local');
      }
    }
    return local;
  }

  async saveReadingPlan(userId: string, plan: ReadingPlan): Promise<void> {
    const filePath = this.getFilePath(userId, 'plans');
    const list = this.readJson<ReadingPlan[]>(filePath, []);
    const idx = list.findIndex(p => p.bookTitle.toLowerCase() === plan.bookTitle.toLowerCase());
    if (idx >= 0) {
      list[idx] = plan;
    } else {
      list.push(plan);
    }
    this.writeJson(filePath, list);

    const supabase = getSupabaseAdmin();
    if (supabase) {
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
        logger.debug({ err, userId }, 'Supabase saveReadingPlan upsert error');
      }
    }
  }
}

export const coachMemory = new CoachMemoryBank();
