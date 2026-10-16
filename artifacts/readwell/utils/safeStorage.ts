/**
 * Defensive parsing and recovery for reading data read from AsyncStorage.
 * Pure (no AsyncStorage access) so it can be thoroughly unit tested.
 */

import { Book, UserProfile, ReadingSession, DailyActivity } from '@/types';

export interface ParsedStored<T> {
  value: T;
  /** True when raw was present but malformed or the wrong shape. */
  corrupt: boolean;
}

export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseStoredJson<T>(
  raw: string | null | undefined,
  fallback: T,
  isValid: (v: unknown) => boolean,
): ParsedStored<T> {
  if (!raw) return { value: fallback, corrupt: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return { value: parsed as T, corrupt: false };
  } catch {
    // fall through to corrupt
  }
  return { value: fallback, corrupt: true };
}

/**
 * Recovers valid JSON objects from a truncated or partially damaged JSON array string.
 * Useful when writing to AsyncStorage was interrupted (e.g. phone died, OS killed app).
 */
export function salvageJsonObjects<T>(
  raw: string,
  isValidItem: (item: unknown) => item is T,
): T[] {
  if (!raw || typeof raw !== 'string') return [];

  // 1. Try standard parse first
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(isValidItem);
    }
  } catch {
    // Truncated or malformed — proceed to salvage scan
  }

  // 2. Scan for top-level balanced objects `{ ... }` within the string
  const results: T[] = [];
  let depth = 0;
  let startIdx = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && startIdx !== -1) {
        const candidate = raw.slice(startIdx, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (isValidItem(parsed)) {
            results.push(parsed);
          }
        } catch {
          // Ignore invalid chunk
        }
        startIdx = -1;
      } else if (depth < 0) {
        depth = 0;
        startIdx = -1;
      }
    }
  }

  return results;
}

/**
 * Validates and repairs a Book object.
 * Fixes corrupt indices, missing segments, or bad string types.
 * Returns null only if the record is completely unidentifiable (missing id).
 */
export function sanitizeBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;

  if (typeof b.id !== 'string' || !b.id.trim()) return null;

  const id = b.id.trim();
  const title = typeof b.title === 'string' && b.title.trim() ? b.title.trim() : 'Untitled';
  const author = typeof b.author === 'string' && b.author.trim() ? b.author.trim() : 'Unknown';
  const content = typeof b.content === 'string' ? b.content : '';
  const coverColor = typeof b.coverColor === 'string' && b.coverColor ? b.coverColor : '#4F46E5';
  const status: 'in_progress' | 'finished' = b.status === 'finished' ? 'finished' : 'in_progress';
  const createdAt = typeof b.createdAt === 'string' && b.createdAt ? b.createdAt : new Date().toISOString();
  const sourceType = b.sourceType === 'pdf' ? 'pdf' : 'text';

  const segments = Array.isArray(b.segments)
    ? b.segments.map((seg, idx) => {
        if (!seg || typeof seg !== 'object') {
          return { index: idx, paragraphs: [] };
        }
        const s = seg as Record<string, unknown>;
        return {
          index: typeof s.index === 'number' && Number.isFinite(s.index) ? s.index : idx,
          paragraphs: Array.isArray(s.paragraphs)
            ? s.paragraphs.filter((p): p is string => typeof p === 'string')
            : [],
          quiz: s.quiz && typeof s.quiz === 'object' ? (s.quiz as any) : undefined,
          pageStart: typeof s.pageStart === 'number' ? s.pageStart : undefined,
          pageEnd: typeof s.pageEnd === 'number' ? s.pageEnd : undefined,
        };
      })
    : [];

  const pages = Array.isArray(b.pages)
    ? b.pages
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
        .map((p, idx) => ({
          pageNumber: typeof p.pageNumber === 'number' ? p.pageNumber : idx + 1,
          imageUrl: typeof p.imageUrl === 'string' ? p.imageUrl : '',
          width: typeof p.width === 'number' && p.width > 0 ? p.width : 800,
          height: typeof p.height === 'number' && p.height > 0 ? p.height : 1200,
          text: typeof p.text === 'string' ? p.text : '',
          lowConfidence: typeof p.lowConfidence === 'boolean' ? p.lowConfidence : undefined,
          ocrUsed: typeof p.ocrUsed === 'boolean' ? p.ocrUsed : undefined,
        }))
    : sourceType === 'pdf' ? [] : undefined;

  // Reading progress sanity check
  const totalUnits = segments.length > 0 ? segments.length : (pages ? pages.length : 1);
  let currentSegmentIndex = 0;

  if (typeof b.currentSegmentIndex === 'number' && Number.isFinite(b.currentSegmentIndex)) {
    currentSegmentIndex = Math.max(0, Math.floor(b.currentSegmentIndex));
    // If book is marked in_progress but index exceeds segments, clamp to last available segment
    if (status === 'in_progress' && totalUnits > 0 && currentSegmentIndex >= totalUnits) {
      currentSegmentIndex = Math.max(0, totalUnits - 1);
    }
  }

  const wordCount =
    typeof b.wordCount === 'number' && Number.isFinite(b.wordCount) && b.wordCount >= 0
      ? Math.floor(b.wordCount)
      : content.split(/\s+/).filter(Boolean).length;

  return {
    id,
    title,
    author,
    content,
    segments,
    status,
    createdAt,
    wordCount,
    currentSegmentIndex,
    coverColor,
    complexityIndex: typeof b.complexityIndex === 'number' ? b.complexityIndex : undefined,
    sourceType,
    pages,
    ocrUsed: typeof b.ocrUsed === 'boolean' || b.ocrUsed === null ? b.ocrUsed : undefined,
  };
}

/**
 * Validates and repairs a ReadingSession object.
 */
export function sanitizeSession(raw: unknown): ReadingSession | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;

  if (typeof s.id !== 'string' || !s.id.trim()) return null;
  if (typeof s.bookId !== 'string' || !s.bookId.trim()) return null;

  return {
    id: s.id.trim(),
    bookId: s.bookId.trim(),
    startedAt: typeof s.startedAt === 'string' ? s.startedAt : new Date().toISOString(),
    secondsRead: typeof s.secondsRead === 'number' && Number.isFinite(s.secondsRead) ? Math.max(0, Math.floor(s.secondsRead)) : 0,
    segmentsCompleted: typeof s.segmentsCompleted === 'number' && Number.isFinite(s.segmentsCompleted) ? Math.max(1, Math.floor(s.segmentsCompleted)) : 1,
    comprehensionScore: typeof s.comprehensionScore === 'number' && Number.isFinite(s.comprehensionScore) ? Math.max(0, Math.min(100, s.comprehensionScore)) : 0,
    xpEarned: typeof s.xpEarned === 'number' && Number.isFinite(s.xpEarned) ? Math.max(0, Math.floor(s.xpEarned)) : 0,
  };
}

/**
 * Validates and repairs a DailyActivity object.
 */
export function sanitizeDailyActivity(raw: unknown): DailyActivity | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;

  if (typeof d.date !== 'string' || !d.date.trim()) return null;

  return {
    date: d.date.trim(),
    minutesRead: typeof d.minutesRead === 'number' && Number.isFinite(d.minutesRead) ? Math.max(0, Math.floor(d.minutesRead)) : 0,
    xpEarned: typeof d.xpEarned === 'number' && Number.isFinite(d.xpEarned) ? Math.max(0, Math.floor(d.xpEarned)) : 0,
    goalMet: Boolean(d.goalMet),
  };
}

/**
 * Validates and repairs a UserProfile object, guaranteeing no NaN or undefined metrics.
 */
export function sanitizeProfile(raw: unknown, defaultProfile: UserProfile): UserProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaultProfile;
  const p = raw as Record<string, unknown>;

  return {
    ...defaultProfile,
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : defaultProfile.name,
    displayName: typeof p.displayName === 'string' ? p.displayName : defaultProfile.displayName,
    ageGroup: p.ageGroup === 'teen' ? 'teen' : 'adult',
    readingLevel: p.readingLevel === 'beginner' || p.readingLevel === 'advanced' ? p.readingLevel : 'intermediate',
    interests: Array.isArray(p.interests) ? p.interests.filter((i): i is string => typeof i === 'string') : defaultProfile.interests,
    dailyGoalMinutes: typeof p.dailyGoalMinutes === 'number' && Number.isFinite(p.dailyGoalMinutes) && p.dailyGoalMinutes > 0 ? Math.floor(p.dailyGoalMinutes) : defaultProfile.dailyGoalMinutes,
    xp: typeof p.xp === 'number' && Number.isFinite(p.xp) ? Math.max(0, p.xp) : defaultProfile.xp,
    totalXp: typeof p.totalXp === 'number' && Number.isFinite(p.totalXp) ? Math.max(0, p.totalXp) : defaultProfile.totalXp,
    xpDomains: p.xpDomains && typeof p.xpDomains === 'object' && !Array.isArray(p.xpDomains) ? (p.xpDomains as Record<string, number>) : defaultProfile.xpDomains,
    level: typeof p.level === 'number' && Number.isFinite(p.level) ? Math.max(1, p.level) : defaultProfile.level,
    comprehensionScore: typeof p.comprehensionScore === 'number' && Number.isFinite(p.comprehensionScore) ? p.comprehensionScore : defaultProfile.comprehensionScore,
    comprehensionTrend: p.comprehensionTrend === 'up' || p.comprehensionTrend === 'down' ? p.comprehensionTrend : 'flat',
    streakCurrent: typeof p.streakCurrent === 'number' && Number.isFinite(p.streakCurrent) ? Math.max(0, p.streakCurrent) : 0,
    streakBest: typeof p.streakBest === 'number' && Number.isFinite(p.streakBest) ? Math.max(0, p.streakBest) : 0,
    lastReadDate: typeof p.lastReadDate === 'string' ? p.lastReadDate : null,
    badges: Array.isArray(p.badges) ? p.badges.filter((b): b is any => typeof b === 'string') : defaultProfile.badges,
    onboardingComplete: typeof p.onboardingComplete === 'boolean' ? p.onboardingComplete : true,
    totalMinutesRead: typeof p.totalMinutesRead === 'number' && Number.isFinite(p.totalMinutesRead) ? Math.max(0, p.totalMinutesRead) : 0,
    totalBooksFinished: typeof p.totalBooksFinished === 'number' && Number.isFinite(p.totalBooksFinished) ? Math.max(0, p.totalBooksFinished) : 0,
    email: typeof p.email === 'string' ? p.email : defaultProfile.email,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : defaultProfile.createdAt,
  };
}
