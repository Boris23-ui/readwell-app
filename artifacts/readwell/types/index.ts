export interface UserProfile {
  name: string;
  ageGroup: 'teen' | 'adult';
  readingLevel: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  dailyGoalMinutes: number;
  xp: number;
  level: number;
  streakCurrent: number;
  streakBest: number;
  lastReadDate: string | null;
  badges: BadgeKey[];
  onboardingComplete: boolean;
  totalMinutesRead: number;
  totalBooksFinished: number;
  createdAt: string;
}

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
}

export interface Segment {
  index: number;
  paragraphs: string[];
  quiz?: Quiz;
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
