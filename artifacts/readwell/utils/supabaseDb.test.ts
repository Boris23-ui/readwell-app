import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => false,
  supabase: {},
}));

import {
  isUuid,
  userStorageKey,
  toSupabaseUserUpsert,
  mergeSupabaseUserProfile,
  mergeLocalAndRemoteBooks,
  toSupabaseSessionRow,
  fromSupabaseSessionRow,
  mergeLocalAndRemoteSessions,
  mergeLocalAndRemoteDaily,
} from './supabaseDb';
import type { Book, ReadingSession, UserProfile } from '@/types';

const SAMPLE_UUID = '11111111-2222-4333-8444-555555555555';

const BASE_PROFILE: UserProfile = {
  name: 'Amina',
  ageGroup: 'adult',
  readingLevel: 'intermediate',
  interests: ['Science'],
  dailyGoalMinutes: 20,
  xp: 250,
  xpDomains: { general: 250, fiction: 0, technical: 0, science: 0 },
  level: 2,
  comprehensionScore: 85,
  comprehensionTrend: 'up',
  streakCurrent: 5,
  streakBest: 7,
  lastReadDate: '2026-11-20',
  badges: ['first-book'],
  onboardingComplete: true,
  totalMinutesRead: 120,
  totalBooksFinished: 1,
  email: 'amina@example.com',
  createdAt: '2026-11-01T00:00:00.000Z',
};

describe('supabaseDb schema alignment & merge helpers', () => {
  it('validates Supabase UUIDs and rejects guest/dev identifiers', () => {
    expect(isUuid(SAMPLE_UUID)).toBe(true);
    expect(isUuid('guest_user')).toBe(false);
    expect(isUuid('dev_admin_001')).toBe(false);
  });

  it('scopes local storage keys distinctly per userId', () => {
    const keyA = userStorageKey('@readwell/books', 'user_a');
    const keyB = userStorageKey('@readwell/books', 'user_b');
    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('user_a');
    expect(keyB).toContain('user_b');
  });

  it('emits only columns defined in 001_initial_schema.sql for public.users upsert', () => {
    const row = toSupabaseUserUpsert(SAMPLE_UUID, BASE_PROFILE) as Record<string, unknown>;
    expect(row.id).toBe(SAMPLE_UUID);
    expect(row.display_name).toBe('Amina');
    expect(row.daily_goal_minutes).toBe(20);
    expect(row.xp).toBe(250);
    // Must NOT contain non-existent schema columns
    expect(row).not.toHaveProperty('last_read_date');
    expect(row).not.toHaveProperty('badges');
    expect(row).not.toHaveProperty('total_minutes_read');
    expect(row).not.toHaveProperty('total_books_finished');
  });

  it('preserves local-only profile fields when merging remote public.users row', () => {
    const merged = mergeSupabaseUserProfile(BASE_PROFILE, {
      display_name: 'Amina K.',
      xp: 300,
      level: 3,
      streak_current: 6,
      streak_best: 8,
    });
    expect(merged.name).toBe('Amina K.');
    expect(merged.xp).toBe(300);
    expect(merged.badges).toEqual(['first-book']);
    expect(merged.comprehensionScore).toBe(85);
    expect(merged.totalMinutesRead).toBe(120);
  });

  it('round-trips session comprehensionScore (0..100) without NUMERIC(5,2) overflow or /20 corruption', () => {
    const session: ReadingSession = {
      id: 'sess-1',
      bookId: 'book-1',
      startedAt: '2026-11-20T10:00:00.000Z',
      secondsRead: 180,
      segmentsCompleted: 1,
      comprehensionScore: 80,
      xpEarned: 45,
    };

    const row = toSupabaseSessionRow(SAMPLE_UUID, session);
    expect(row.focus_score).toBe(80);
    expect(row.focus_score).toBeLessThanOrEqual(100);

    const parsed = fromSupabaseSessionRow(row);
    expect(parsed.comprehensionScore).toBe(80);
  });

  it('preserves local-only books and avoids creating hollow empty-segment shells', () => {
    const localBook: Book = {
      id: 'local-1',
      title: 'Local Draft',
      author: 'Author',
      content: 'Paragraph one.\n\nParagraph two.',
      segments: [{ index: 0, paragraphs: ['Paragraph one.', 'Paragraph two.'] }],
      status: 'in_progress',
      createdAt: '2026-11-20T00:00:00.000Z',
      wordCount: 50,
      currentSegmentIndex: 0,
      coverColor: '#CF6D4D',
      sourceType: 'text',
    };

    const merged = mergeLocalAndRemoteBooks(
      [localBook],
      [
        { id: 'remote-only-shell', title: 'Other Device Book', author: 'Someone' },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('local-1');
    expect(merged[0].segments).toHaveLength(1);
  });

  it('merges local and remote sessions & daily activities without data loss', () => {
    const localSession: ReadingSession = {
      id: 's1',
      bookId: 'b1',
      startedAt: '2026-11-20T12:00:00.000Z',
      secondsRead: 120,
      segmentsCompleted: 1,
      comprehensionScore: 100,
      xpEarned: 52,
    };
    const mergedSessions = mergeLocalAndRemoteSessions([localSession], [
      { id: 's1', content_id: 'b1', started_at: '2026-11-20T12:00:00.000Z', seconds_read: 120, focus_score: 100 },
      { id: 's2', content_id: 'b1', started_at: '2026-11-19T12:00:00.000Z', seconds_read: 300, focus_score: 75 },
    ]);
    expect(mergedSessions).toHaveLength(2);
    expect(mergedSessions[0].xpEarned).toBe(52);
    expect(mergedSessions[1].comprehensionScore).toBe(75);

    const mergedDaily = mergeLocalAndRemoteDaily(
      [{ date: '2026-11-20', minutesRead: 15, xpEarned: 40, goalMet: false }],
      [{ date: '2026-11-20', minutes_read: 25, xp_earned: 65, goal_met: true }],
    );
    expect(mergedDaily[0]).toEqual({
      date: '2026-11-20',
      minutesRead: 25,
      xpEarned: 65,
      goalMet: true,
    });
  });
});
