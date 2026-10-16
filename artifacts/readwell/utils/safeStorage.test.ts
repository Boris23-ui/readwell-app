import { describe, it, expect } from 'vitest';
import {
  parseStoredJson,
  isArray,
  isPlainObject,
  salvageJsonObjects,
  sanitizeBook,
  sanitizeSession,
  sanitizeDailyActivity,
  sanitizeProfile,
} from './safeStorage';
import { Book, UserProfile } from '@/types';

describe('parseStoredJson', () => {
  it('returns fallback when raw is null or empty', () => {
    expect(parseStoredJson(null, [], isArray)).toEqual({ value: [], corrupt: false });
    expect(parseStoredJson('', [], isArray)).toEqual({ value: [], corrupt: false });
  });

  it('returns parsed value when valid', () => {
    expect(parseStoredJson('[1,2]', [], isArray)).toEqual({ value: [1, 2], corrupt: false });
  });

  it('flags malformed JSON as corrupt and returns fallback', () => {
    expect(parseStoredJson('{"a":', [], isArray)).toEqual({ value: [], corrupt: true });
  });

  it('flags wrong-shaped JSON as corrupt (object where array expected)', () => {
    expect(parseStoredJson('{"a":1}', [], isArray)).toEqual({ value: [], corrupt: true });
  });

  it('flags null/array as invalid for plain objects', () => {
    const fb = { x: 1 };
    expect(parseStoredJson('null', fb, isPlainObject).corrupt).toBe(true);
    expect(parseStoredJson('[]', fb, isPlainObject).corrupt).toBe(true);
    expect(parseStoredJson('{"y":2}', fb, isPlainObject)).toEqual({ value: { y: 2 }, corrupt: false });
  });
});

describe('salvageJsonObjects', () => {
  const isBookCandidate = (item: unknown): item is { id: string; title: string } => {
    return Boolean(item && typeof item === 'object' && 'id' in item);
  };

  it('parses complete JSON array normally', () => {
    const raw = JSON.stringify([
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' },
    ]);
    const salvaged = salvageJsonObjects(raw, isBookCandidate);
    expect(salvaged).toHaveLength(2);
    expect(salvaged[0].id).toBe('1');
    expect(salvaged[1].id).toBe('2');
  });

  it('salvages complete objects from a truncated JSON array string', () => {
    // Simulates an abrupt write failure halfway through writing the second or third object
    const truncated = `[
      {"id": "book-1", "title": "The Odyssey", "author": "Homer"},
      {"id": "book-2", "title": "1984", "author": "George Orwell"},
      {"id": "book-3", "title": "Hamlet", "author": "Shakespeare", "con`;

    const salvaged = salvageJsonObjects(truncated, isBookCandidate);
    expect(salvaged).toHaveLength(2);
    expect(salvaged[0].id).toBe('book-1');
    expect(salvaged[1].id).toBe('book-2');
  });

  it('handles strings with nested braces and escaped quotes', () => {
    const complexTruncated = `[
      {"id": "b1", "title": "Quote: {\\"hello\\"} in title", "segments": [{"index": 0}]},
      {"id": "b2", "unclosed": {`;

    const salvaged = salvageJsonObjects(complexTruncated, isBookCandidate);
    expect(salvaged).toHaveLength(1);
    expect(salvaged[0].id).toBe('b1');
  });

  it('returns empty array for non-salvageable string', () => {
    expect(salvageJsonObjects('not json at all', isBookCandidate)).toEqual([]);
    expect(salvageJsonObjects('', isBookCandidate)).toEqual([]);
  });
});

describe('sanitizeBook', () => {
  it('returns null if input is not an object or lacks id', () => {
    expect(sanitizeBook(null)).toBeNull();
    expect(sanitizeBook('string')).toBeNull();
    expect(sanitizeBook({})).toBeNull();
    expect(sanitizeBook({ id: '' })).toBeNull();
  });

  it('repairs missing or corrupt fields with safe fallbacks', () => {
    const raw = {
      id: 'book-123',
      // title missing
      // author missing
      segments: 'not-an-array',
      currentSegmentIndex: -5,
      wordCount: 'invalid',
    };

    const book = sanitizeBook(raw);
    expect(book).not.toBeNull();
    expect(book?.id).toBe('book-123');
    expect(book?.title).toBe('Untitled');
    expect(book?.author).toBe('Unknown');
    expect(book?.segments).toEqual([]);
    expect(book?.currentSegmentIndex).toBe(0);
    expect(book?.status).toBe('in_progress');
    expect(book?.coverColor).toBe('#4F46E5');
  });

  it('clamps currentSegmentIndex to last valid segment if out of bounds in progress', () => {
    const raw = {
      id: 'book-456',
      title: 'Valid Book',
      status: 'in_progress',
      currentSegmentIndex: 99,
      segments: [{ index: 0, paragraphs: ['P1'] }, { index: 1, paragraphs: ['P2'] }],
    };

    const book = sanitizeBook(raw);
    expect(book?.currentSegmentIndex).toBe(1);
  });

  it('normalizes NaN and float segment indices', () => {
    const raw = {
      id: 'book-789',
      currentSegmentIndex: NaN,
      segments: [{ index: 0, paragraphs: [] }],
    };

    const book = sanitizeBook(raw);
    expect(book?.currentSegmentIndex).toBe(0);
  });

  it('preserves valid PDF pages array and properties', () => {
    const raw = {
      id: 'pdf-1',
      sourceType: 'pdf',
      pages: [
        { pageNumber: 1, imageUrl: '/objects/p1.jpg', width: 800, height: 1200, text: 'Hello' },
        null, // corrupt element
      ],
    };

    const book = sanitizeBook(raw);
    expect(book?.sourceType).toBe('pdf');
    expect(book?.pages).toHaveLength(1);
    expect(book?.pages?.[0].pageNumber).toBe(1);
  });
});

describe('sanitizeSession', () => {
  it('validates session and clamps scores', () => {
    expect(sanitizeSession(null)).toBeNull();
    expect(sanitizeSession({ id: 's1' })).toBeNull(); // missing bookId

    const valid = sanitizeSession({
      id: 's1',
      bookId: 'b1',
      secondsRead: -50,
      comprehensionScore: 120, // out of range
    });

    expect(valid).not.toBeNull();
    expect(valid?.secondsRead).toBe(0);
    expect(valid?.comprehensionScore).toBe(100);
  });

  it('handles NaN or missing session metrics safely', () => {
    const session = sanitizeSession({
      id: 's2',
      bookId: 'b2',
      comprehensionScore: NaN,
      secondsRead: undefined,
      xpEarned: NaN,
      segmentsCompleted: -2,
    });

    expect(session).not.toBeNull();
    expect(session?.comprehensionScore).toBe(0);
    expect(session?.secondsRead).toBe(0);
    expect(session?.xpEarned).toBe(0);
    expect(session?.segmentsCompleted).toBe(1);
  });
});

describe('sanitizeDailyActivity', () => {
  it('validates daily activity and defaults invalid numbers', () => {
    expect(sanitizeDailyActivity(null)).toBeNull();
    expect(sanitizeDailyActivity({ date: '' })).toBeNull();

    const activity = sanitizeDailyActivity({
      date: '2026-10-17',
      minutesRead: NaN,
      xpEarned: -10,
      goalMet: 1,
    });

    expect(activity?.date).toBe('2026-10-17');
    expect(activity?.minutesRead).toBe(0);
    expect(activity?.xpEarned).toBe(0);
    expect(activity?.goalMet).toBe(true);
  });
});

describe('sanitizeProfile', () => {
  const defaultProfile: UserProfile = {
    name: 'Default User',
    ageGroup: 'adult',
    readingLevel: 'intermediate',
    interests: [],
    dailyGoalMinutes: 20,
    xp: 0,
    xpDomains: { general: 0, fiction: 0, technical: 0, science: 0 },
    level: 1,
    comprehensionScore: 80,
    streakCurrent: 0,
    streakBest: 0,
    lastReadDate: null,
    badges: [],
    onboardingComplete: true,
    totalMinutesRead: 0,
    totalBooksFinished: 0,
    createdAt: new Date().toISOString(),
  };

  it('repairs corrupt profile with NaN/undefined numbers', () => {
    const corrupt = {
      name: 'Corrupt Profile',
      xp: NaN,
      level: -5,
      streakCurrent: undefined,
      interests: 'not-an-array',
      badges: [123, null, 'first-book'],
      totalMinutesRead: NaN,
      dailyGoalMinutes: -10,
    };

    const profile = sanitizeProfile(corrupt, defaultProfile);
    expect(profile.name).toBe('Corrupt Profile');
    expect(profile.xp).toBe(0);
    expect(profile.level).toBe(1);
    expect(profile.streakCurrent).toBe(0);
    expect(profile.interests).toEqual([]);
    expect(profile.badges).toEqual(['first-book']);
    expect(profile.totalMinutesRead).toBe(0);
    expect(profile.dailyGoalMinutes).toBe(20);
  });
});
