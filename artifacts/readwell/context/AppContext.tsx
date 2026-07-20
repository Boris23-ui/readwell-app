import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, Book, ReadingSession, DailyActivity, BadgeKey, Segment, Quiz } from '@/types';

function getLevelFromXp(totalXp: number): number {
  let level = 1;
  let xpRequired = 100;
  let accumulated = 0;
  while (accumulated + xpRequired <= totalXp) {
    accumulated += xpRequired;
    level++;
    xpRequired = Math.floor(xpRequired * 1.4);
  }
  return level;
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

const STORAGE_KEYS = {
  PROFILE: '@readwell/profile',
  BOOKS: '@readwell/books',
  SESSIONS: '@readwell/sessions',
  DAILY: '@readwell/daily',
};

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  ageGroup: 'adult',
  readingLevel: 'intermediate',
  interests: [],
  dailyGoalMinutes: 20,
  xp: 0,
  level: 1,
  streakCurrent: 0,
  streakBest: 0,
  lastReadDate: null,
  badges: [],
  onboardingComplete: false,
  totalMinutesRead: 0,
  totalBooksFinished: 0,
  createdAt: new Date().toISOString(),
};

interface AppContextType {
  profile: UserProfile;
  books: Book[];
  sessions: ReadingSession[];
  dailyActivities: DailyActivity[];
  isLoading: boolean;
  saveProfile: (profile: UserProfile) => Promise<void>;
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;
  addBook: (book: Book) => Promise<void>;
  updateBook: (id: string, partial: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  cacheSegmentQuiz: (bookId: string, segmentIndex: number, quiz: Quiz) => Promise<void>;
  completeSession: (session: Omit<ReadingSession, 'id'>) => Promise<{ newBadges: BadgeKey[] }>;
  getTodayActivity: () => DailyActivity | null;
  getBookById: (id: string) => Book | undefined;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [books, setBooks] = useState<Book[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [dailyActivities, setDailyActivities] = useState<DailyActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pr, br, sr, dr] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
          AsyncStorage.getItem(STORAGE_KEYS.BOOKS),
          AsyncStorage.getItem(STORAGE_KEYS.SESSIONS),
          AsyncStorage.getItem(STORAGE_KEYS.DAILY),
        ]);
        if (pr) setProfile(JSON.parse(pr));
        if (br) setBooks(JSON.parse(br));
        if (sr) setSessions(JSON.parse(sr));
        if (dr) setDailyActivities(JSON.parse(dr));
      } catch (e) {
        console.error('Failed to load data', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const saveProfile = useCallback(async (p: UserProfile) => {
    setProfile(p);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(p));
  }, []);

  const updateProfile = useCallback(async (partial: Partial<UserProfile>) => {
    setProfile(prev => {
      const updated = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addBook = useCallback(async (book: Book) => {
    setBooks(prev => {
      const updated = [...prev, book];
      AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateBook = useCallback(async (id: string, partial: Partial<Book>) => {
    setBooks(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...partial } : b);
      AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteBook = useCallback(async (id: string) => {
    setBooks(prev => {
      const updated = prev.filter(b => b.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const cacheSegmentQuiz = useCallback(async (bookId: string, segmentIndex: number, quiz: Quiz) => {
    setBooks(prev => {
      const updated = prev.map(b => {
        if (b.id !== bookId) return b;
        const updatedSegments = b.segments.map((s: Segment) =>
          s.index === segmentIndex ? { ...s, quiz } : s
        );
        return { ...b, segments: updatedSegments };
      });
      AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const completeSession = useCallback(async (
    sessionData: Omit<ReadingSession, 'id'>
  ): Promise<{ newBadges: BadgeKey[] }> => {
    const session: ReadingSession = {
      ...sessionData,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    };

    setSessions(prev => {
      const updated = [...prev, session];
      AsyncStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(updated));
      return updated;
    });

    const today = todayString();
    const minutesRead = Math.floor(session.secondsRead / 60);

    setDailyActivities(prev => {
      const existing = prev.find(a => a.date === today);
      const newMinutes = (existing?.minutesRead ?? 0) + minutesRead;
      const newXp = (existing?.xpEarned ?? 0) + session.xpEarned;
      let updated: DailyActivity[];
      if (existing) {
        updated = prev.map(a =>
          a.date === today
            ? { ...a, minutesRead: newMinutes, xpEarned: newXp, goalMet: newMinutes >= profile.dailyGoalMinutes }
            : a
        );
      } else {
        updated = [...prev, {
          date: today,
          minutesRead: newMinutes,
          xpEarned: newXp,
          goalMet: newMinutes >= profile.dailyGoalMinutes,
        }];
      }
      AsyncStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(updated));
      return updated;
    });

    const newTotalXp = profile.xp + session.xpEarned;
    const newLevel = getLevelFromXp(newTotalXp);
    const newTotalMinutes = profile.totalMinutesRead + minutesRead;

    let newStreak = profile.streakCurrent;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (profile.lastReadDate === today) {
      // already counted
    } else if (profile.lastReadDate === yesterdayStr || profile.lastReadDate === null) {
      newStreak = profile.streakCurrent + 1;
    } else {
      newStreak = 1;
    }

    const newBadges: BadgeKey[] = [];
    const hour = new Date().getHours();
    if (!profile.badges.includes('night-owl') && hour >= 22) newBadges.push('night-owl');
    if (!profile.badges.includes('early-bird') && hour < 7) newBadges.push('early-bird');
    if (!profile.badges.includes('streak-7') && newStreak >= 7) newBadges.push('streak-7');
    if (!profile.badges.includes('streak-30') && newStreak >= 30) newBadges.push('streak-30');
    if (!profile.badges.includes('bookworm') && newTotalMinutes >= 100) newBadges.push('bookworm');
    if (!profile.badges.includes('comeback') && profile.lastReadDate) {
      const lastDate = new Date(profile.lastReadDate);
      const diff = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 7) newBadges.push('comeback');
    }

    const updatedProfile: UserProfile = {
      ...profile,
      xp: newTotalXp,
      level: newLevel,
      streakCurrent: newStreak,
      streakBest: Math.max(profile.streakBest, newStreak),
      lastReadDate: today,
      totalMinutesRead: newTotalMinutes,
      badges: [...profile.badges, ...newBadges],
    };
    setProfile(updatedProfile);
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updatedProfile));

    return { newBadges };
  }, [profile]);

  const getTodayActivity = useCallback((): DailyActivity | null => {
    const today = todayString();
    return dailyActivities.find(a => a.date === today) ?? null;
  }, [dailyActivities]);

  const getBookById = useCallback((id: string): Book | undefined => {
    return books.find(b => b.id === id);
  }, [books]);

  return (
    <AppContext.Provider value={{
      profile, books, sessions, dailyActivities, isLoading,
      saveProfile, updateProfile,
      addBook, updateBook, deleteBook, cacheSegmentQuiz,
      completeSession, getTodayActivity, getBookById,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
