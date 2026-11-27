import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile, Book, ReadingSession, DailyActivity } from '@/types';
import {
  parseStoredJson,
  isArray,
  isPlainObject,
  sanitizeBook,
  sanitizeSession,
  sanitizeDailyActivity,
  sanitizeProfile,
  salvageJsonObjects,
} from './safeStorage';

// Base local storage keys (scoped per userId via userStorageKey)
const KEYS = {
  PROFILE: '@readwell/profile',
  BOOKS: '@readwell/books',
  SESSIONS: '@readwell/sessions',
  DAILY: '@readwell/daily',
  LEGACY_OWNER: '@readwell/legacy-storage-owner',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function userStorageKey(baseKey: string, userId: string): string {
  const safeId = (userId || 'guest_user').trim() || 'guest_user';
  return `${baseKey}::${safeId}`;
}

function canSyncCloud(userId: string): boolean {
  return isSupabaseConfigured() && isUuid(userId);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

// ----------------------------------------------------------------------------
// PURE SCHEMA-ALIGNMENT & MERGE HELPERS (exported for unit testing)
// ----------------------------------------------------------------------------

/**
 * Maps a UserProfile strictly to columns defined in `001_initial_schema.sql`
 * `public.users` so Supabase upserts never fail on non-existent columns.
 */
export function toSupabaseUserUpsert(userId: string, profile: UserProfile) {
  return {
    id: userId,
    email: profile.email || `${userId}@readwell.app`,
    display_name: profile.name || null,
    age_band: profile.ageGroup,
    reading_level: profile.readingLevel,
    interests: profile.interests,
    daily_goal_minutes: profile.dailyGoalMinutes,
    xp: profile.xp,
    level: profile.level,
    streak_current: profile.streakCurrent,
    streak_best: profile.streakBest,
    updated_at: new Date().toISOString(),
  };
}

export function mergeSupabaseUserProfile(
  localProfile: UserProfile,
  row: Record<string, any>,
): UserProfile {
  return {
    ...localProfile,
    name: row.display_name || localProfile.name,
    ageGroup: row.age_band === 'teen' ? 'teen' : 'adult',
    readingLevel:
      row.reading_level === 'beginner' || row.reading_level === 'advanced'
        ? row.reading_level
        : 'intermediate',
    interests: Array.isArray(row.interests) ? row.interests : localProfile.interests,
    dailyGoalMinutes: row.daily_goal_minutes ?? localProfile.dailyGoalMinutes,
    xp: Math.max(Number(row.xp) || 0, localProfile.xp || 0),
    level: Math.max(Number(row.level) || 1, localProfile.level || 1),
    streakCurrent: Math.max(Number(row.streak_current) || 0, localProfile.streakCurrent || 0),
    streakBest: Math.max(Number(row.streak_best) || 0, localProfile.streakBest || 0),
    onboardingComplete: Boolean(row.display_name || localProfile.onboardingComplete),
    email: row.email || localProfile.email,
  };
}

/**
 * Merges local books with remote `public.contents` metadata without ever
 * discarding local-only books or injecting hollow unreadable shells (`segments: []`).
 */
export function mergeLocalAndRemoteBooks(
  localBooks: Book[],
  remoteRows: Array<Record<string, any>>,
): Book[] {
  const remoteById = new Map<string, Record<string, any>>();
  for (const row of remoteRows) {
    if (row && typeof row.id === 'string') {
      remoteById.set(row.id, row);
    }
  }

  return localBooks.map((book) => {
    const remote = remoteById.get(book.id);
    if (!remote) return book;
    return {
      ...book,
      title: book.title || remote.title || 'Untitled',
      author: book.author || remote.author || '',
      coverColor: book.coverColor || remote.cover_color || '#CF6D4D',
    };
  });
}

/**
 * Maps a ReadingSession to `public.reading_sessions` without overflowing
 * `focus_score NUMERIC(5,2)`.
 */
export function toSupabaseSessionRow(userId: string, session: ReadingSession) {
  return {
    id: session.id,
    user_id: userId,
    content_id: session.bookId,
    started_at: session.startedAt,
    ended_at: new Date().toISOString(),
    seconds_read: Math.max(0, Math.floor(session.secondsRead || 0)),
    paragraphs_read: Math.max(1, Math.floor(session.segmentsCompleted || 1)) * 5,
    focus_score: clampScore(session.comprehensionScore),
  };
}

export function fromSupabaseSessionRow(
  row: Record<string, any>,
  localMatch?: ReadingSession,
): ReadingSession {
  const rawScore = Number(row.focus_score);
  // Guard against any legacy rows that might have stored 0..100 cleanly
  const comprehensionScore = Number.isFinite(rawScore) ? clampScore(rawScore) : 0;

  return {
    id: String(row.id),
    bookId: String(row.content_id || localMatch?.bookId || ''),
    startedAt: typeof row.started_at === 'string' ? row.started_at : new Date().toISOString(),
    secondsRead:
      typeof row.seconds_read === 'number' && Number.isFinite(row.seconds_read)
        ? Math.max(0, Math.floor(row.seconds_read))
        : localMatch?.secondsRead ?? 0,
    segmentsCompleted:
      localMatch?.segmentsCompleted ??
      Math.max(1, Math.floor((Number(row.paragraphs_read) || 5) / 5)),
    comprehensionScore: localMatch ? localMatch.comprehensionScore : comprehensionScore,
    xpEarned:
      localMatch?.xpEarned ??
      Math.min(60, Math.floor((Number(row.seconds_read) || 0) / 60)),
  };
}

export function mergeLocalAndRemoteSessions(
  localSessions: ReadingSession[],
  remoteRows: Array<Record<string, any>>,
): ReadingSession[] {
  const localById = new Map(localSessions.map((s) => [s.id, s]));
  const merged = new Map<string, ReadingSession>();

  for (const s of localSessions) {
    merged.set(s.id, s);
  }

  for (const row of remoteRows) {
    if (!row || typeof row.id !== 'string') continue;
    const local = localById.get(row.id);
    if (!local) {
      merged.set(row.id, fromSupabaseSessionRow(row));
    }
  }

  return Array.from(merged.values()).sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
}

export function mergeLocalAndRemoteDaily(
  localDaily: DailyActivity[],
  remoteRows: Array<Record<string, any>>,
): DailyActivity[] {
  const byDate = new Map<string, DailyActivity>();
  for (const act of localDaily) {
    byDate.set(act.date, act);
  }

  for (const row of remoteRows) {
    if (!row || typeof row.date !== 'string') continue;
    const remoteAct: DailyActivity = {
      date: row.date,
      minutesRead: Math.max(0, Number(row.minutes_read) || 0),
      xpEarned: Math.max(0, Number(row.xp_earned) || 0),
      goalMet: Boolean(row.goal_met),
    };
    const existing = byDate.get(remoteAct.date);
    if (!existing) {
      byDate.set(remoteAct.date, remoteAct);
    } else {
      byDate.set(remoteAct.date, {
        date: remoteAct.date,
        minutesRead: Math.max(existing.minutesRead, remoteAct.minutesRead),
        xpEarned: Math.max(existing.xpEarned, remoteAct.xpEarned),
        goalMet: existing.goalMet || remoteAct.goalMet,
      });
    }
  }

  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

// ----------------------------------------------------------------------------
// USER-SCOPED LOCAL STORAGE WITH TRANSPARENT LEGACY MIGRATION
// ----------------------------------------------------------------------------

async function readLocal<T>(
  baseKey: string,
  userId: string,
  fallback: T,
  isValid: (v: unknown) => boolean,
): Promise<T> {
  const scopedKey = userStorageKey(baseKey, userId);
  let raw = await AsyncStorage.getItem(scopedKey);

  // Transparently migrate legacy unscoped data to the first user who reads it
  if (raw === null) {
    try {
      const legacyRaw = await AsyncStorage.getItem(baseKey);
      if (legacyRaw !== null) {
        const legacyOwner = await AsyncStorage.getItem(KEYS.LEGACY_OWNER);
        if (!legacyOwner || legacyOwner === userId) {
          raw = legacyRaw;
          await AsyncStorage.setItem(KEYS.LEGACY_OWNER, userId);
          await AsyncStorage.setItem(scopedKey, legacyRaw);
        }
      }
    } catch (err) {
      console.warn(`Legacy storage migration check failed for ${baseKey}:`, err);
    }
  }

  const { value, corrupt } = parseStoredJson<T>(raw, fallback, isValid);
  if (corrupt && raw) {
    console.warn(`Corrupt local data for ${scopedKey}; using fallback.`);
    try {
      await AsyncStorage.setItem(`${scopedKey}.corrupt`, raw);
    } catch (err) {
      console.warn(`Could not back up corrupt data for ${scopedKey}:`, err);
    }
  }
  return value;
}

async function readCorruptBackup(baseKey: string, userId: string): Promise<string | null> {
  const scopedKey = userStorageKey(baseKey, userId);
  const scopedCorrupt = await AsyncStorage.getItem(`${scopedKey}.corrupt`);
  if (scopedCorrupt) return scopedCorrupt;
  const legacyOwner = await AsyncStorage.getItem(KEYS.LEGACY_OWNER);
  if (!legacyOwner || legacyOwner === userId) {
    return AsyncStorage.getItem(`${baseKey}.corrupt`);
  }
  return null;
}

// ----------------------------------------------------------------------------
// USERS & PROFILES
// ----------------------------------------------------------------------------

export async function getProfileFromDb(
  userId: string,
  defaultProfile: UserProfile,
): Promise<UserProfile> {
  const rawProfile: UserProfile = await readLocal<UserProfile>(
    KEYS.PROFILE,
    userId,
    defaultProfile,
    isPlainObject,
  );
  const localProfile: UserProfile = sanitizeProfile(rawProfile, defaultProfile);

  if (canSyncCloud(userId)) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        const profile = mergeSupabaseUserProfile(localProfile, data);
        await AsyncStorage.setItem(userStorageKey(KEYS.PROFILE, userId), JSON.stringify(profile));
        return profile;
      }
    } catch (err) {
      console.warn('Supabase getProfileFromDb fallback to local:', err);
    }
  }

  return localProfile;
}

export async function saveProfileToDb(userId: string, profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(userStorageKey(KEYS.PROFILE, userId), JSON.stringify(profile));

  if (canSyncCloud(userId)) {
    try {
      await supabase.from('users').upsert(toSupabaseUserUpsert(userId, profile));
    } catch (err) {
      console.warn('Supabase saveProfileToDb error:', err);
    }
  }
}

// ----------------------------------------------------------------------------
// BOOKS / CONTENTS
// ----------------------------------------------------------------------------

export async function getBooksFromDb(userId: string): Promise<Book[]> {
  let localBooks: Book[] = await readLocal<Book[]>(KEYS.BOOKS, userId, [], isArray);

  if (localBooks.length === 0) {
    try {
      const corruptRaw = await readCorruptBackup(KEYS.BOOKS, userId);
      if (corruptRaw) {
        const salvaged = salvageJsonObjects(corruptRaw, (item): item is Book =>
          Boolean(sanitizeBook(item)),
        );
        if (salvaged.length > 0) {
          localBooks = salvaged.map(sanitizeBook).filter((b): b is Book => b !== null);
          console.info(`Recovered ${localBooks.length} book(s) from corrupt storage backup.`);
          await AsyncStorage.setItem(
            userStorageKey(KEYS.BOOKS, userId),
            JSON.stringify(localBooks),
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error attempting book salvage from backup:', err);
    }
  }

  const cleanBooks: Book[] = localBooks
    .map(sanitizeBook)
    .filter((b): b is Book => b !== null);

  if (canSyncCloud(userId)) {
    try {
      const { data, error } = await supabase
        .from('contents')
        .select('*')
        .eq('owner_id', userId);

      if (data && !error && data.length > 0) {
        const mergedBooks = mergeLocalAndRemoteBooks(cleanBooks, data);
        await AsyncStorage.setItem(
          userStorageKey(KEYS.BOOKS, userId),
          JSON.stringify(mergedBooks),
        );
        return mergedBooks;
      }
    } catch (err) {
      console.warn('Supabase getBooksFromDb fallback to local:', err);
    }
  }

  return cleanBooks;
}

export async function saveBookToDb(userId: string, book: Book): Promise<void> {
  const sanitized = sanitizeBook(book) || book;
  const rawList: Book[] = await readLocal<Book[]>(KEYS.BOOKS, userId, [], isArray);
  const list: Book[] = rawList
    .map(sanitizeBook)
    .filter((b): b is Book => b !== null);

  const idx = list.findIndex((b) => b.id === sanitized.id);
  if (idx >= 0) {
    list[idx] = sanitized;
  } else {
    list.push(sanitized);
  }
  await AsyncStorage.setItem(userStorageKey(KEYS.BOOKS, userId), JSON.stringify(list));

  if (canSyncCloud(userId)) {
    try {
      await supabase.from('contents').upsert({
        id: sanitized.id,
        owner_id: userId,
        title: sanitized.title,
        author: sanitized.author,
        source_type: sanitized.sourceType || 'text',
        word_count: sanitized.wordCount || 0,
        cover_color: sanitized.coverColor,
        status: 'ready',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Supabase saveBookToDb error:', err);
    }
  }
}

export async function deleteBookFromDb(userId: string, bookId: string): Promise<void> {
  const rawList: Book[] = await readLocal<Book[]>(KEYS.BOOKS, userId, [], isArray);
  const list: Book[] = rawList
    .map(sanitizeBook)
    .filter((b): b is Book => b !== null);

  const updated = list.filter((b) => b.id !== bookId);
  await AsyncStorage.setItem(userStorageKey(KEYS.BOOKS, userId), JSON.stringify(updated));

  if (canSyncCloud(userId)) {
    try {
      await supabase.from('contents').delete().eq('id', bookId).eq('owner_id', userId);
    } catch (err) {
      console.warn('Supabase deleteBookFromDb error:', err);
    }
  }
}

// ----------------------------------------------------------------------------
// SESSIONS & DAILY ACTIVITY
// ----------------------------------------------------------------------------

export async function getSessionsFromDb(userId: string): Promise<ReadingSession[]> {
  let local: ReadingSession[] = await readLocal<ReadingSession[]>(
    KEYS.SESSIONS,
    userId,
    [],
    isArray,
  );

  if (local.length === 0) {
    try {
      const corruptRaw = await readCorruptBackup(KEYS.SESSIONS, userId);
      if (corruptRaw) {
        const salvaged = salvageJsonObjects(corruptRaw, (item): item is ReadingSession =>
          Boolean(sanitizeSession(item)),
        );
        if (salvaged.length > 0) {
          local = salvaged.map(sanitizeSession).filter((s): s is ReadingSession => s !== null);
          console.info(`Recovered ${local.length} session(s) from corrupt storage backup.`);
          await AsyncStorage.setItem(
            userStorageKey(KEYS.SESSIONS, userId),
            JSON.stringify(local),
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error attempting session salvage from backup:', err);
    }
  }

  const cleanSessions = local
    .map(sanitizeSession)
    .filter((s): s is ReadingSession => s !== null);

  if (canSyncCloud(userId)) {
    try {
      const { data, error } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (data && !error && data.length > 0) {
        const merged = mergeLocalAndRemoteSessions(cleanSessions, data);
        await AsyncStorage.setItem(
          userStorageKey(KEYS.SESSIONS, userId),
          JSON.stringify(merged),
        ).catch(() => {});
        return merged;
      }
    } catch (err) {
      console.warn('Supabase getSessionsFromDb fallback to local:', err);
    }
  }

  return cleanSessions;
}

export async function saveSessionToDb(userId: string, session: ReadingSession): Promise<void> {
  const sanitized = sanitizeSession(session) || session;
  const rawList: ReadingSession[] = await readLocal<ReadingSession[]>(
    KEYS.SESSIONS,
    userId,
    [],
    isArray,
  );
  const list: ReadingSession[] = rawList
    .map(sanitizeSession)
    .filter((s): s is ReadingSession => s !== null);

  list.unshift(sanitized);
  await AsyncStorage.setItem(userStorageKey(KEYS.SESSIONS, userId), JSON.stringify(list));

  if (canSyncCloud(userId)) {
    try {
      await supabase.from('reading_sessions').insert(toSupabaseSessionRow(userId, sanitized));
    } catch (err) {
      console.warn('Supabase saveSessionToDb error:', err);
    }
  }
}

export async function getDailyActivitiesFromDb(userId: string): Promise<DailyActivity[]> {
  let local: DailyActivity[] = await readLocal<DailyActivity[]>(
    KEYS.DAILY,
    userId,
    [],
    isArray,
  );

  if (local.length === 0) {
    try {
      const corruptRaw = await readCorruptBackup(KEYS.DAILY, userId);
      if (corruptRaw) {
        const salvaged = salvageJsonObjects(corruptRaw, (item): item is DailyActivity =>
          Boolean(sanitizeDailyActivity(item)),
        );
        if (salvaged.length > 0) {
          local = salvaged
            .map(sanitizeDailyActivity)
            .filter((d): d is DailyActivity => d !== null);
          console.info(`Recovered ${local.length} daily activity record(s) from corrupt storage backup.`);
          await AsyncStorage.setItem(
            userStorageKey(KEYS.DAILY, userId),
            JSON.stringify(local),
          ).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error attempting daily activity salvage from backup:', err);
    }
  }

  const cleanDaily = local
    .map(sanitizeDailyActivity)
    .filter((d): d is DailyActivity => d !== null);

  if (canSyncCloud(userId)) {
    try {
      const { data, error } = await supabase
        .from('daily_activity')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (data && !error && data.length > 0) {
        const merged = mergeLocalAndRemoteDaily(cleanDaily, data);
        await AsyncStorage.setItem(
          userStorageKey(KEYS.DAILY, userId),
          JSON.stringify(merged),
        ).catch(() => {});
        return merged;
      }
    } catch (err) {
      console.warn('Supabase getDailyActivitiesFromDb fallback to local:', err);
    }
  }

  return cleanDaily;
}

export async function saveDailyActivityToDb(
  userId: string,
  act: DailyActivity,
): Promise<void> {
  const sanitized = sanitizeDailyActivity(act) || act;
  const rawList: DailyActivity[] = await readLocal<DailyActivity[]>(
    KEYS.DAILY,
    userId,
    [],
    isArray,
  );
  const list: DailyActivity[] = rawList
    .map(sanitizeDailyActivity)
    .filter((d): d is DailyActivity => d !== null);

  const idx = list.findIndex((a) => a.date === sanitized.date);
  if (idx >= 0) {
    list[idx] = sanitized;
  } else {
    list.push(sanitized);
  }
  await AsyncStorage.setItem(userStorageKey(KEYS.DAILY, userId), JSON.stringify(list));

  if (canSyncCloud(userId)) {
    try {
      await supabase.from('daily_activity').upsert({
        user_id: userId,
        date: sanitized.date,
        minutes_read: sanitized.minutesRead,
        xp_earned: sanitized.xpEarned,
        goal_met: sanitized.goalMet,
      });
    } catch (err) {
      console.warn('Supabase saveDailyActivityToDb error:', err);
    }
  }
}
