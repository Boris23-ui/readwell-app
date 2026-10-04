import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile, Book, ReadingSession, DailyActivity } from '@/types';

// Local storage fallback keys
const KEYS = {
  PROFILE: '@readwell/profile',
  BOOKS: '@readwell/books',
  SESSIONS: '@readwell/sessions',
  DAILY: '@readwell/daily',

  MESSAGES: '@readwell/messages-',
};

// ----------------------------------------------------------------------------
// USERS & PROFILES
// ----------------------------------------------------------------------------

export async function getProfileFromDb(userId: string, defaultProfile: UserProfile): Promise<UserProfile> {
  const localRaw = await AsyncStorage.getItem(KEYS.PROFILE);
  const localProfile: UserProfile = localRaw ? JSON.parse(localRaw) : defaultProfile;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        const profile: UserProfile = {
          ...localProfile,
          name: data.display_name || localProfile.name,
          ageGroup: (data.age_band === 'teen' ? 'teen' : 'adult') as 'teen' | 'adult',
          readingLevel: (data.reading_level === 'beginner' || data.reading_level === 'advanced' ? data.reading_level : 'intermediate') as any,
          interests: data.interests || localProfile.interests,
          dailyGoalMinutes: data.daily_goal_minutes ?? localProfile.dailyGoalMinutes,
          xp: data.xp ?? localProfile.xp,
          level: data.level ?? localProfile.level,
          comprehensionScore: data.comprehensionScore ?? localProfile.comprehensionScore ?? 0,
          comprehensionTrend: data.comprehensionTrend ?? localProfile.comprehensionTrend ?? 'flat',
          xpDomains: localProfile.xpDomains || { general: 0, fiction: 0, technical: 0, science: 0 },
          streakCurrent: data.streak_current ?? localProfile.streakCurrent,
          streakBest: data.streak_best ?? localProfile.streakBest,
          lastReadDate: data.last_read_date ?? localProfile.lastReadDate,
          badges: data.badges || localProfile.badges,
          onboardingComplete: true,
          totalMinutesRead: data.total_minutes_read ?? localProfile.totalMinutesRead,
          totalBooksFinished: data.total_books_finished ?? localProfile.totalBooksFinished,

          email: data.email || localProfile.email,
        };
        await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
        return profile;
      }
    } catch (err) {
      console.warn('Supabase getProfileFromDb fallback to local:', err);
    }
  }

  return localProfile;
}

export async function saveProfileToDb(userId: string, profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('users').upsert({
        id: userId,
        email: profile.email || `${userId}@readwell.app`,
        display_name: profile.name,
        age_band: profile.ageGroup,
        reading_level: profile.readingLevel,
        interests: profile.interests,
        daily_goal_minutes: profile.dailyGoalMinutes,
        xp: profile.xp,
        level: profile.level,
        streak_current: profile.streakCurrent,
        streak_best: profile.streakBest,
        last_read_date: profile.lastReadDate,
        badges: profile.badges,
        total_minutes_read: profile.totalMinutesRead,
        total_books_finished: profile.totalBooksFinished,

        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Supabase saveProfileToDb error:', err);
    }
  }
}

// ----------------------------------------------------------------------------
// BOOKS / CONTENTS
// ----------------------------------------------------------------------------

export async function getBooksFromDb(userId: string): Promise<Book[]> {
  const localRaw = await AsyncStorage.getItem(KEYS.BOOKS);
  const localBooks: Book[] = localRaw ? JSON.parse(localRaw) : [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('contents')
        .select('*')
        .eq('owner_id', userId);

      if (data && !error && data.length > 0) {
        const mergedBooks: Book[] = data.map((d: any) => {
          const matched = localBooks.find(b => b.id === d.id);
          if (matched) return matched;
          return {
            id: d.id,
            title: d.title,
            author: d.author || 'Unknown',
            coverColor: d.cover_color || '#4F46E5',
            sourceType: (d.source_type === 'pdf' ? 'pdf' : 'text'),
            content: '',
            segments: [],
            wordCount: d.word_count || 0,
            status: 'in_progress',
            currentSegmentIndex: 0,
            createdAt: d.created_at || new Date().toISOString(),
          } as Book;
        });
        await AsyncStorage.setItem(KEYS.BOOKS, JSON.stringify(mergedBooks));
        return mergedBooks;
      }
    } catch (err) {
      console.warn('Supabase getBooksFromDb fallback to local:', err);
    }
  }

  return localBooks;
}

export async function saveBookToDb(userId: string, book: Book): Promise<void> {
  const localRaw = await AsyncStorage.getItem(KEYS.BOOKS);
  const list: Book[] = localRaw ? JSON.parse(localRaw) : [];
  const idx = list.findIndex(b => b.id === book.id);
  if (idx >= 0) {
    list[idx] = book;
  } else {
    list.push(book);
  }
  await AsyncStorage.setItem(KEYS.BOOKS, JSON.stringify(list));

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('contents').upsert({
        id: book.id,
        owner_id: userId,
        title: book.title,
        author: book.author,
        source_type: book.sourceType || 'text',
        word_count: book.wordCount || 0,
        cover_color: book.coverColor,
        status: book.status === 'finished' ? 'ready' : 'processing',
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Supabase saveBookToDb error:', err);
    }
  }
}

export async function deleteBookFromDb(userId: string, bookId: string): Promise<void> {
  const localRaw = await AsyncStorage.getItem(KEYS.BOOKS);
  if (localRaw) {
    const list: Book[] = JSON.parse(localRaw);
    const updated = list.filter(b => b.id !== bookId);
    await AsyncStorage.setItem(KEYS.BOOKS, JSON.stringify(updated));
  }

  if (isSupabaseConfigured()) {
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
  const localRaw = await AsyncStorage.getItem(KEYS.SESSIONS);
  const local: ReadingSession[] = localRaw ? JSON.parse(localRaw) : [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('reading_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false });

      if (data && !error && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          bookId: d.content_id,
          startedAt: d.started_at,
          secondsRead: d.seconds_read || 0,
          segmentsCompleted: Math.max(1, Math.floor((d.paragraphs_read || 5) / 5)),
          comprehensionScore: (d.focus_score || 80) / 20,
          xpEarned: Math.floor((d.seconds_read || 0) / 60) * 10,
        }));
      }
    } catch (err) {
      console.warn('Supabase getSessionsFromDb fallback to local:', err);
    }
  }

  return local;
}

export async function saveSessionToDb(userId: string, session: ReadingSession): Promise<void> {
  const localRaw = await AsyncStorage.getItem(KEYS.SESSIONS);
  const list: ReadingSession[] = localRaw ? JSON.parse(localRaw) : [];
  list.unshift(session);
  await AsyncStorage.setItem(KEYS.SESSIONS, JSON.stringify(list));

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('reading_sessions').insert({
        id: session.id,
        user_id: userId,
        content_id: session.bookId,
        started_at: session.startedAt,
        ended_at: new Date().toISOString(),
        seconds_read: session.secondsRead,
        paragraphs_read: (session.segmentsCompleted || 1) * 5,
        focus_score: (session.comprehensionScore || 4) * 20,
      });
    } catch (err) {
      console.warn('Supabase saveSessionToDb error:', err);
    }
  }
}

export async function getDailyActivitiesFromDb(userId: string): Promise<DailyActivity[]> {
  const localRaw = await AsyncStorage.getItem(KEYS.DAILY);
  const local: DailyActivity[] = localRaw ? JSON.parse(localRaw) : [];

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('daily_activity')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (data && !error && data.length > 0) {
        return data.map((d: any) => ({
          date: d.date,
          minutesRead: d.minutes_read,
          xpEarned: d.xp_earned,
          goalMet: d.goal_met,
        }));
      }
    } catch (err) {
      console.warn('Supabase getDailyActivitiesFromDb fallback to local:', err);
    }
  }

  return local;
}

export async function saveDailyActivityToDb(userId: string, act: DailyActivity): Promise<void> {
  const localRaw = await AsyncStorage.getItem(KEYS.DAILY);
  const list: DailyActivity[] = localRaw ? JSON.parse(localRaw) : [];
  const idx = list.findIndex(a => a.date === act.date);
  if (idx >= 0) {
    list[idx] = act;
  } else {
    list.push(act);
  }
  await AsyncStorage.setItem(KEYS.DAILY, JSON.stringify(list));

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('daily_activity').upsert({
        user_id: userId,
        date: act.date,
        minutes_read: act.minutesRead,
        xp_earned: act.xpEarned,
        goal_met: act.goalMet,
      });
    } catch (err) {
      console.warn('Supabase saveDailyActivityToDb error:', err);
    }
  }
}



