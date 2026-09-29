import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
  UserProfile,
  Book,
  ReadingSession,
  DailyActivity,
  BadgeKey,
  Segment,
  Quiz,
} from '@/types';
import { deletePdfPages } from '@/utils/api';
import { runOrphanCleanup, type PendingPdfImport } from './orphanCleanup';
import { applyOcrMigration, parsePendingImports } from './AppContext';
import {
  getProfileFromDb,
  saveProfileToDb,
  getBooksFromDb,
  saveBookToDb,
  deleteBookFromDb,
  getSessionsFromDb,
  saveSessionToDb,
  getDailyActivitiesFromDb,
  saveDailyActivityToDb,
} from '../utils/supabaseDb';

const STORAGE_KEYS = {
  PENDING_PDF_IMPORTS: '@readwell/pending-pdf-imports',
  PENDING_PDF_DELETIONS: '@readwell/pending-pdf-deletions',
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  ageGroup: 'adult',
  readingLevel: 'intermediate',
  interests: [],
  dailyGoalMinutes: 20,
  xp: 0,
  xpDomains: { general: 0, fiction: 0, technical: 0, science: 0 },
  level: 1,
  elo: 100,
  streakCurrent: 0,
  streakBest: 0,
  lastReadDate: null,
  badges: [],
  onboardingComplete: false,
  totalMinutesRead: 0,
  totalBooksFinished: 0,
  tokens: 15,
  createdAt: new Date().toISOString(),
};

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
  completeSession: (
    session: Omit<ReadingSession, 'id'>,
    opts?: { bookFinished?: boolean; isPerfectQuiz?: boolean }
  ) => Promise<{ newBadges: BadgeKey[] }>;
  getTodayActivity: () => DailyActivity | null;
  getBookById: (id: string) => Book | undefined;
  registerPendingPdfImport: (serverBookId: string) => Promise<void>;
  clearPendingPdfImport: (serverBookId: string) => Promise<void>;
  consumeToken: () => boolean;
  addTokens: (amount: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [books, setBooks] = useState<Book[]>([]);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [dailyActivities, setDailyActivities] = useState<DailyActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from Supabase or Local Storage
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const currentUserId = user?.uid || 'guest_user';
      try {
        // Load Profile
        const loadedProfile = await getProfileFromDb(currentUserId, DEFAULT_PROFILE);
        if (isMounted) setProfile(loadedProfile);

        // Load Books
        const loadedBooks = await getBooksFromDb(currentUserId);
        const { books: migratedBooks, dirty } = applyOcrMigration(loadedBooks);
        if (isMounted) setBooks(migratedBooks);
        if (dirty) {
          migratedBooks.forEach(b => saveBookToDb(currentUserId, b));
        }

        // Load Sessions
        const loadedSessions = await getSessionsFromDb(currentUserId);
        if (isMounted) setSessions(loadedSessions);

        // Load Daily Activities
        const loadedDaily = await getDailyActivitiesFromDb(currentUserId);
        if (isMounted) setDailyActivities(loadedDaily);

        // Orphan PDF cleanup
        const pendingRaw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_IMPORTS);
        const pending = parsePendingImports(pendingRaw);
        if (pending !== null) {
          const { stillPending } = await runOrphanCleanup(
            pending,
            migratedBooks,
            Date.now(),
            (bookId) => deletePdfPages(bookId).catch(() => {})
          );
          await AsyncStorage.setItem(STORAGE_KEYS.PENDING_PDF_IMPORTS, JSON.stringify(stillPending));
        }
      } catch (e) {
        console.error('Failed to load application data:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const saveProfile = useCallback(async (p: UserProfile) => {
    const currentUserId = user?.uid || 'guest_user';
    setProfile(p);
    await saveProfileToDb(currentUserId, p);
  }, [user]);

  const updateProfile = useCallback(async (partial: Partial<UserProfile>) => {
    const currentUserId = user?.uid || 'guest_user';
    setProfile(prev => {
      const updated = { ...prev, ...partial };
      saveProfileToDb(currentUserId, updated).catch(console.error);
      return updated;
    });
  }, [user]);

  const consumeToken = useCallback((): boolean => {
    if (profile.tokens <= 0) return false;
    const currentUserId = user?.uid || 'guest_user';
    const updated = { ...profile, tokens: profile.tokens - 1 };
    setProfile(updated);
    saveProfileToDb(currentUserId, updated).catch(console.error);
    return true;
  }, [profile, user]);

  const addTokens = useCallback((amount: number) => {
    if (amount <= 0) return;
    const currentUserId = user?.uid || 'guest_user';
    const updated = { ...profile, tokens: profile.tokens + amount };
    setProfile(updated);
    saveProfileToDb(currentUserId, updated).catch(console.error);
  }, [profile, user]);

  const addBook = useCallback(async (book: Book) => {
    const currentUserId = user?.uid || 'guest_user';
    setBooks(prev => {
      const updated = [...prev, book];
      saveBookToDb(currentUserId, book).catch(console.error);
      return updated;
    });
  }, [user]);

  const updateBook = useCallback(async (id: string, partial: Partial<Book>) => {
    const currentUserId = user?.uid || 'guest_user';
    setBooks(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...partial } : b);
      const bookDoc = updated.find(b => b.id === id);
      if (bookDoc) {
        saveBookToDb(currentUserId, bookDoc).catch(console.error);
      }
      return updated;
    });
  }, [user]);

  const deleteBook = useCallback(async (id: string) => {
    const currentUserId = user?.uid || 'guest_user';
    setBooks(prev => {
      const book = prev.find(b => b.id === id);
      const updated = prev.filter(b => b.id !== id);
      deleteBookFromDb(currentUserId, id).catch(console.error);

      if (book?.sourceType === 'pdf' && book.pages && book.pages.length > 0) {
        const imageUrl = book.pages[0].imageUrl;
        const match = imageUrl.match(/\/objects\/pdf-pages\/([^/]+)\//);
        if (match) {
          const serverBookId = match[1];
          deletePdfPages(serverBookId).catch(console.error);
        }
      }
      return updated;
    });
  }, [user]);

  const cacheSegmentQuiz = useCallback(async (bookId: string, segmentIndex: number, quiz: Quiz) => {
    const currentUserId = user?.uid || 'guest_user';
    setBooks(prev => {
      const updated = prev.map(b => {
        if (b.id !== bookId) return b;
        const updatedSegments = b.segments.map((s: Segment) =>
          s.index === segmentIndex ? { ...s, quiz } : s
        );
        return { ...b, segments: updatedSegments };
      });
      const bookDoc = updated.find(b => b.id === bookId);
      if (bookDoc) {
        saveBookToDb(currentUserId, bookDoc).catch(console.error);
      }
      return updated;
    });
  }, [user]);

  const completeSession = useCallback(async (
    sessionData: Omit<ReadingSession, 'id'>,
    opts: { bookFinished?: boolean; isPerfectQuiz?: boolean } = {}
  ): Promise<{ newBadges: BadgeKey[] }> => {
    const currentUserId = user?.uid || 'guest_user';
    const session: ReadingSession = {
      ...sessionData,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    };

    setSessions(prev => {
      const updated = [session, ...prev];
      saveSessionToDb(currentUserId, session).catch(console.error);
      return updated;
    });

    const today = todayString();
    const minutesRead = Math.floor(session.secondsRead / 60);

    setDailyActivities(prev => {
      const existing = prev.find(a => a.date === today);
      const newMinutes = (existing?.minutesRead ?? 0) + minutesRead;
      const newXp = (existing?.xpEarned ?? 0) + session.xpEarned;
      const act = { date: today, minutesRead: newMinutes, xpEarned: newXp, goalMet: newMinutes >= profile.dailyGoalMinutes };
      
      saveDailyActivityToDb(currentUserId, act).catch(console.error);

      if (existing) {
        return prev.map(a => a.date === today ? act : a);
      } else {
        return [act, ...prev];
      }
    });

    const newTotalXp = profile.xp + session.xpEarned;
    const newElo = (profile.elo || 100) + (session.eloEarned || 0);
    const newXpDomains = {
      ...profile.xpDomains,
      general: (profile.xpDomains?.general || 0) + session.xpEarned,
    };
    const newLevel = getLevelFromXp(newTotalXp);
    const newTotalMinutes = profile.totalMinutesRead + minutesRead;

    let newStreak = profile.streakCurrent;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (profile.lastReadDate === today) {
      // already read today, streak stays
    } else if (profile.lastReadDate === yesterdayStr || profile.lastReadDate === null) {
      newStreak = profile.streakCurrent + 1;
    } else {
      newStreak = 1;
    }

    const newTotalBooksFinished = profile.totalBooksFinished + (opts.bookFinished ? 1 : 0);

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
    if (!profile.badges.includes('first-book') && newTotalBooksFinished >= 1) newBadges.push('first-book');
    if (!profile.badges.includes('perfect-quiz') && opts.isPerfectQuiz) newBadges.push('perfect-quiz');

    const updatedProfile: UserProfile = {
      ...profile,
      xp: newTotalXp,
      elo: newElo,
      xpDomains: newXpDomains,
      level: newLevel,
      streakCurrent: newStreak,
      streakBest: Math.max(profile.streakBest, newStreak),
      lastReadDate: today,
      totalMinutesRead: newTotalMinutes,
      totalBooksFinished: newTotalBooksFinished,
      badges: [...profile.badges, ...newBadges],
    };
    setProfile(updatedProfile);
    saveProfileToDb(currentUserId, updatedProfile).catch(console.error);

    return { newBadges };
  }, [profile, user]);

  const getTodayActivity = useCallback((): DailyActivity | null => {
    const today = todayString();
    return dailyActivities.find(a => a.date === today) ?? null;
  }, [dailyActivities]);

  const getBookById = useCallback((id: string): Book | undefined => {
    return books.find(b => b.id === id);
  }, [books]);

  const registerPendingPdfImport = useCallback(async (serverBookId: string) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_IMPORTS);
      const existing: PendingPdfImport[] = raw ? JSON.parse(raw) : [];
      const filtered = existing.filter(e => e.serverBookId !== serverBookId);
      filtered.push({ serverBookId, registeredAt: new Date().toISOString() });
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_PDF_IMPORTS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('registerPendingPdfImport failed', e);
    }
  }, []);

  const clearPendingPdfImport = useCallback(async (serverBookId: string) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_IMPORTS);
      if (!raw) return;
      const existing: PendingPdfImport[] = JSON.parse(raw);
      const filtered = existing.filter(e => e.serverBookId !== serverBookId);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_PDF_IMPORTS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('clearPendingPdfImport failed', e);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        profile,
        books,
        sessions,
        dailyActivities,
        isLoading,
        saveProfile,
        updateProfile,
        addBook,
        updateBook,
        deleteBook,
        cacheSegmentQuiz,
        completeSession,
        getTodayActivity,
        getBookById,
        registerPendingPdfImport,
        clearPendingPdfImport,
        consumeToken,
        addTokens,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
