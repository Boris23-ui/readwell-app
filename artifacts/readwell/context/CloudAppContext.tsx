import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { useAuth } from './AuthContext';
import { UserProfile, Book, ReadingSession, DailyActivity, BadgeKey, Segment, Quiz, UserProfileSchema, BookSchema } from '@/types';
import { deletePdfPages } from '@/utils/api';
import { runOrphanCleanup, type PendingPdfImport } from './orphanCleanup';
import { inferOcrUsed, applyOcrMigration, parsePendingImports } from './AppContext'; // Re-use utilities from local context

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
  completeSession: (session: Omit<ReadingSession, 'id'>, opts?: { bookFinished?: boolean; isPerfectQuiz?: boolean }) => Promise<{ newBadges: BadgeKey[] }>;
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

  // Load from Firestore
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const uid = user.uid;
        
        // Load Profile
        const profileRef = doc(db, 'users', uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserProfile);
        } else {
          await setDoc(profileRef, DEFAULT_PROFILE);
        }

        // Load Books
        const booksRef = collection(db, 'users', uid, 'books');
        const booksSnap = await getDocs(booksRef);
        let savedBooks = booksSnap.docs.map(d => d.data() as Book);
        
        const { books: migratedBooks, dirty } = applyOcrMigration(savedBooks);
        savedBooks = migratedBooks;
        if (dirty) {
          savedBooks.forEach(b => setDoc(doc(db, 'users', uid, 'books', b.id), b));
        }
        setBooks(savedBooks);

        // Load Sessions
        const sessionsRef = collection(db, 'users', uid, 'sessions');
        const sessionsSnap = await getDocs(sessionsRef);
        setSessions(sessionsSnap.docs.map(d => d.data() as ReadingSession));

        // Load Daily Activities
        const dailyRef = collection(db, 'users', uid, 'daily');
        const dailySnap = await getDocs(dailyRef);
        setDailyActivities(dailySnap.docs.map(d => d.data() as DailyActivity));

        // Local tasks (cleanup)
        const pendingRaw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_IMPORTS);
        const pending = parsePendingImports(pendingRaw);
        if (pending !== null) {
          const { stillPending } = await runOrphanCleanup(
            pending,
            savedBooks,
            Date.now(),
            (bookId) => deletePdfPages(bookId).catch(() => {})
          );
          await AsyncStorage.setItem(STORAGE_KEYS.PENDING_PDF_IMPORTS, JSON.stringify(stillPending));
        }
      } catch (e) {
        console.error('Failed to load cloud data', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const saveProfile = useCallback(async (p: UserProfile) => {
    if (!user) return;
    setProfile(p);
    await setDoc(doc(db, 'users', user.uid), p);
  }, [user]);

  const updateProfile = useCallback(async (partial: Partial<UserProfile>) => {
    if (!user) return;
    setProfile(prev => {
      const updated = { ...prev, ...partial };
      setDoc(doc(db, 'users', user.uid), updated, { merge: true }).catch(console.error);
      return updated;
    });
  }, [user]);

  const consumeToken = useCallback((): boolean => {
    let success = false;
    if (!user) return false;
    setProfile(prev => {
      if (prev.tokens > 0) {
        success = true;
        const updated = { ...prev, tokens: prev.tokens - 1 };
        updateDoc(doc(db, 'users', user.uid), { tokens: prev.tokens - 1 }).catch(console.error);
        return updated;
      }
      return prev;
    });
    return success;
  }, [user]);

  const addTokens = useCallback((amount: number) => {
    if (!user) return;
    setProfile(prev => {
      const updated = { ...prev, tokens: prev.tokens + amount };
      updateDoc(doc(db, 'users', user.uid), { tokens: prev.tokens + amount }).catch(console.error);
      return updated;
    });
  }, [user]);

  const addBook = useCallback(async (book: Book) => {
    if (!user) return;
    setBooks(prev => {
      const updated = [...prev, book];
      setDoc(doc(db, 'users', user.uid, 'books', book.id), book).catch(console.error);
      return updated;
    });
  }, [user]);

  const updateBook = useCallback(async (id: string, partial: Partial<Book>) => {
    if (!user) return;
    setBooks(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...partial } : b);
      const bookDoc = updated.find(b => b.id === id);
      if (bookDoc) {
        setDoc(doc(db, 'users', user.uid, 'books', id), bookDoc).catch(console.error);
      }
      return updated;
    });
  }, [user]);

  const deleteBook = useCallback(async (id: string) => {
    if (!user) return;
    setBooks(prev => {
      const book = prev.find(b => b.id === id);
      const updated = prev.filter(b => b.id !== id);
      deleteDoc(doc(db, 'users', user.uid, 'books', id)).catch(console.error);

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
    if (!user) return;
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
        setDoc(doc(db, 'users', user.uid, 'books', bookId), bookDoc).catch(console.error);
      }
      return updated;
    });
  }, [user]);

  const completeSession = useCallback(async (
    sessionData: Omit<ReadingSession, 'id'>,
    opts: { bookFinished?: boolean; isPerfectQuiz?: boolean } = {}
  ): Promise<{ newBadges: BadgeKey[] }> => {
    if (!user) return { newBadges: [] };
    const session: ReadingSession = {
      ...sessionData,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    };

    setSessions(prev => {
      const updated = [...prev, session];
      setDoc(doc(db, 'users', user.uid, 'sessions', session.id), session).catch(console.error);
      return updated;
    });

    const today = todayString();
    const minutesRead = Math.floor(session.secondsRead / 60);

    setDailyActivities(prev => {
      const existing = prev.find(a => a.date === today);
      const newMinutes = (existing?.minutesRead ?? 0) + minutesRead;
      const newXp = (existing?.xpEarned ?? 0) + session.xpEarned;
      const act = { date: today, minutesRead: newMinutes, xpEarned: newXp, goalMet: newMinutes >= profile.dailyGoalMinutes };
      
      setDoc(doc(db, 'users', user.uid, 'daily', today), act).catch(console.error);

      if (existing) {
        return prev.map(a => a.date === today ? act : a);
      } else {
        return [...prev, act];
      }
    });

    const newTotalXp = profile.xp + session.xpEarned;
    const newElo = (profile.elo || 100) + (session.eloEarned || 0);
    const newXpDomains = {
      ...profile.xpDomains,
      general: (profile.xpDomains?.general || 0) + session.xpEarned
    };
    const newLevel = getLevelFromXp(newTotalXp);
    const newTotalMinutes = profile.totalMinutesRead + minutesRead;

    let newStreak = profile.streakCurrent;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (profile.lastReadDate === today) {
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
    setDoc(doc(db, 'users', user.uid), updatedProfile).catch(console.error);

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
    <AppContext.Provider value={{
      profile, books, sessions, dailyActivities, isLoading,
      saveProfile, updateProfile,
      addBook, updateBook, deleteBook, cacheSegmentQuiz,
      completeSession, getTodayActivity, getBookById,
      registerPendingPdfImport, clearPendingPdfImport,
      consumeToken, addTokens,
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
