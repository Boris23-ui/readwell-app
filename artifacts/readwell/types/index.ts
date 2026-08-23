import { z } from 'zod';

export interface UserProfile {
  name: string;
  ageGroup: 'teen' | 'adult';
  readingLevel: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  dailyGoalMinutes: number;
  xp: number;
  xpDomains: Record<string, number>;
  level: number;
  streakCurrent: number;
  streakBest: number;
  lastReadDate: string | null;
  badges: BadgeKey[];
  onboardingComplete: boolean;
  totalMinutesRead: number;
  totalBooksFinished: number;
  tokens: number;
  createdAt: string;
}

export const UserProfileSchema = z.object({
  name: z.string(),
  ageGroup: z.enum(['teen', 'adult']),
  readingLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  interests: z.array(z.string()),
  dailyGoalMinutes: z.number(),
  xp: z.number(),
  xpDomains: z.record(z.number()).default({ general: 0, fiction: 0, technical: 0, science: 0 }),
  level: z.number(),
  streakCurrent: z.number(),
  streakBest: z.number(),
  lastReadDate: z.string().nullable(),
  badges: z.array(z.string()),
  onboardingComplete: z.boolean(),
  totalMinutesRead: z.number(),
  totalBooksFinished: z.number(),
  tokens: z.number().default(15).catch(15),
  createdAt: z.string(),
}).passthrough();

export type BadgeKey =
  | 'first-book'
  | 'streak-7'
  | 'streak-30'
  | 'perfect-quiz'
  | 'night-owl'
  | 'early-bird'
  | 'comeback'
  | 'bookworm';

export interface BadgeInfo {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const BADGE_INFO: Record<BadgeKey, BadgeInfo> = {
  'first-book': { name: 'First Chapter', description: 'Finished your first book', icon: 'book', color: '#E07B39' },
  'streak-7': { name: '7-Day Flame', description: '7 days reading in a row', icon: 'flame', color: '#EF4444' },
  'streak-30': { name: 'Month Strong', description: '30 days reading in a row', icon: 'trophy', color: '#F59E0B' },
  'perfect-quiz': { name: 'Perfect Score', description: 'Scored 5/5 on a quiz', icon: 'star', color: '#8B5CF6' },
  'night-owl': { name: 'Night Owl', description: 'Read after 10pm', icon: 'moon', color: '#6366F1' },
  'early-bird': { name: 'Early Bird', description: 'Read before 7am', icon: 'sun', color: '#F59E0B' },
  'comeback': { name: 'Comeback', description: 'Returned after 7+ days away', icon: 'refresh-cw', color: '#22C55E' },
  'bookworm': { name: 'Bookworm', description: 'Read 100+ minutes total', icon: 'bookmark', color: '#3B82F6' },
};

export type BookSourceType = 'text' | 'pdf';

export interface PdfPage {
  pageNumber: number;
  imageUrl: string; // normalized "/objects/..." path, served via API base
  width: number;
  height: number;
  text: string;
  /** True when the page had too few recoverable words for reliable quiz generation. */
  lowConfidence?: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  content: string;
  segments: Segment[];
  status: 'in_progress' | 'finished';
  createdAt: string;
  wordCount: number;
  currentSegmentIndex: number;
  coverColor: string;
  // Distinguishes the page-image PDF reader from the reflowed text reader.
  sourceType?: BookSourceType;
  // Present only for sourceType === 'pdf'.
  pages?: PdfPage[];
  // True when at least one page was processed via OCR (scanned document).
  // null means inference was attempted but no page text was available; the
  // migration skips such books on future launches to avoid re-running on blank pages.
  ocrUsed?: boolean | null;
}

export interface Segment {
  index: number;
  paragraphs: string[];
  quiz?: Quiz;
  // For PDF books: the inclusive 1-based page range this section covers.
  pageStart?: number;
  pageEnd?: number;
}

export interface Quiz {
  questions: Question[];
}

export interface Question {
  type: 'recall' | 'vocabulary' | 'inference' | 'reflection';
  prompt: string;
  options?: string[];
  correctIndex?: number;
  evidenceQuote?: string;
  isOpenEnded: boolean;
}

export const BookSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  content: z.string(),
  segments: z.array(z.any()), // skipping deep validation for simplicity on segments
  status: z.enum(['in_progress', 'finished']),
  createdAt: z.string(),
  wordCount: z.number(),
  currentSegmentIndex: z.number(),
  coverColor: z.string(),
  sourceType: z.enum(['text', 'pdf']).optional(),
  pages: z.array(z.any()).optional(),
  ocrUsed: z.boolean().nullable().optional(),
}).passthrough();

export interface ReadingSession {
  id: string;
  bookId: string;
  startedAt: string;
  secondsRead: number;
  segmentsCompleted: number;
  comprehensionScore: number;
  xpEarned: number;
}

export interface DailyActivity {
  date: string;
  minutesRead: number;
  xpEarned: number;
  goalMet: boolean;
}
