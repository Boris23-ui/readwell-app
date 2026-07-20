import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, Book, ReadingSession, DailyActivity, BadgeKey, Segment, Quiz } from '@/types';
import { deletePdfPages } from '@/utils/api';
import { runOrphanCleanup } from './orphanCleanup';
import type { PendingPdfImport } from './orphanCleanup';

/**
 * How old a pending import must be before we consider it orphaned and safe to
 * delete. This grace period prevents racing against an in-progress import on
 * the same device.
 */
const PENDING_PDF_GRACE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Heuristic: estimate whether a PDF book was processed via OCR.
 *
 * OCR output from scanned documents typically exhibits:
 *   - Low ratio of alphabetic characters (lots of symbols / noise)
 *   - Very short average word length (garbled tokens, lone punctuation)
 *
 * We sample up to 10 pages, combine their text, and flag the book as
 * OCR-processed when the alphabetic-character ratio falls below 0.60 OR
 * the average word length falls below 3.5 characters.  Either condition
 * alone is a strong signal of OCR output.
 *
 * Returns `undefined` when there is no page text to analyse (cannot
 * determine one way or the other).
 */
function inferOcrUsed(pages: { text: string }[]): boolean | undefined {
  const sample = pages.slice(0, 10);
  const combined = sample.map(p => p.text ?? '').join(' ').trim();
  if (!combined) return undefined;

  // Ratio of alphabetic characters to total non-whitespace characters
  const nonWs = combined.replace(/\s/g, '');
  if (!nonWs.length) return undefined;
  const alphaCount = (nonWs.match(/[a-zA-Z]/g) ?? []).length;
  const alphaRatio = alphaCount / nonWs.length;

  // Average length of whitespace-delimited tokens
  const words = combined.split(/\s+/).filter(w => w.length > 0);
  const avgWordLen = words.length ? words.reduce((s, w) => s + w.length, 0) / words.length : 0;

  return alphaRatio < 0.60 || avgWordLen < 3.5;
}

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
  PENDING_PDF_IMPORTS: '@readwell/pending-pdf-imports',
  /**
   * Persistent queue of server-side bookIds whose PDF page images still need
   * to be deleted. Entries are added before the book is removed locally so
   * that a failed or offline deletion can be retried on the next app launch.
   */
  PENDING_PDF_DELETIONS: '@readwell/pending-pdf-deletions',
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
  completeSession: (session: Omit<ReadingSession, 'id'>, opts?: { bookFinished?: boolean; isPerfectQuiz?: boolean }) => Promise<{ newBadges: BadgeKey[] }>;
  getTodayActivity: () => DailyActivity | null;
  getBookById: (id: string) => Book | undefined;
  /**
   * Record a server-side bookId as "in-flight" so that, if the app is
   * force-closed before the book is saved, the orphaned page images are
   * deleted on the next launch.
   */
  registerPendingPdfImport: (serverBookId: string) => Promise<void>;
  /**
   * Remove a server-side bookId from the pending list (call this once the
   * book has been saved or the pages have been explicitly deleted).
   */
  clearPendingPdfImport: (serverBookId: string) => Promise<void>;
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
        const [pr, br, sr, dr, pendingRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.PROFILE),
          AsyncStorage.getItem(STORAGE_KEYS.BOOKS),
          AsyncStorage.getItem(STORAGE_KEYS.SESSIONS),
          AsyncStorage.getItem(STORAGE_KEYS.DAILY),
          AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_IMPORTS),
        ]);
        if (pr) setProfile(JSON.parse(pr));
        let savedBooks: Book[] = br ? JSON.parse(br) : [];

        // ── OCR backfill migration ──────────────────────────────────────────
        // Books imported before the ocrUsed flag was introduced will not have
        // the field set.  Run a one-time best-effort inference so the "Scanned
        // PDF" badge is shown correctly after an app restart.
        let ocrMigrationDirty = false;
        savedBooks = savedBooks.map(book => {
          if (book.sourceType === 'pdf' && book.ocrUsed === undefined && book.pages?.length) {
            const inferred = inferOcrUsed(book.pages);
            if (inferred !== undefined) {
              ocrMigrationDirty = true;
              return { ...book, ocrUsed: inferred };
            }
          }
          return book;
        });
        if (ocrMigrationDirty) {
          // Persist the backfilled flags so inference only runs once per book.
          AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(savedBooks)).catch(() => {
            console.warn('OCR backfill: failed to persist migrated books');
          });
        }

        if (br || ocrMigrationDirty) setBooks(savedBooks);
        if (sr) setSessions(JSON.parse(sr));
        if (dr) setDailyActivities(JSON.parse(dr));

        // ── Pending deletion retry ─────────────────────────────────────────
        // If deletePdfPages failed (e.g. device was offline) when the user
        // deleted a book, the serverBookId was left in PENDING_PDF_DELETIONS.
        // On every launch we retry those deletions and remove the ones that
        // succeed.
        const deletionsRaw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_DELETIONS);
        if (deletionsRaw) {
          const pendingDeletions: string[] = JSON.parse(deletionsRaw);
          if (pendingDeletions.length > 0) {
            const results = await Promise.allSettled(
              pendingDeletions.map(bookId => deletePdfPages(bookId)),
            );
            const stillFailing = pendingDeletions.filter((_, i) => results[i].status === 'rejected');
            await AsyncStorage.setItem(
              STORAGE_KEYS.PENDING_PDF_DELETIONS,
              JSON.stringify(stillFailing),
            );
          }
        }

        // ── Orphan cleanup ─────────────────────────────────────────────────
        // If the app was force-closed after renderPdf returned but before the
        // book was saved, page images sit in storage forever. On every launch
        // we look for pending imports that are (a) older than the grace period
        // and (b) not present in any saved book, then delete their images.
        if (pendingRaw) {
          const pending: PendingPdfImport[] = JSON.parse(pendingRaw);
          const { stillPending } = await runOrphanCleanup(
            pending,
            savedBooks,
            Date.now(),
            (bookId) =>
              deletePdfPages(bookId).catch(() => {
                console.warn('Orphan cleanup: failed to delete pages for', bookId);
              }),
          );

          // Persist the trimmed list (remove resolved/cleaned entries)
          await AsyncStorage.setItem(
            STORAGE_KEYS.PENDING_PDF_IMPORTS,
            JSON.stringify(stillPending),
          );
        }
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
    // For PDF books, find the server-side bookId from the first page image URL
    // (format: /objects/pdf-pages/<server-bookId>/<page>.jpg) and delete the images.

    // Capture the current books synchronously so we can read the serverBookId.
    setBooks(prev => {
      const book = prev.find(b => b.id === id);
      const updated = prev.filter(b => b.id !== id);
      AsyncStorage.setItem(STORAGE_KEYS.BOOKS, JSON.stringify(updated));

      if (book?.sourceType === 'pdf' && book.pages && book.pages.length > 0) {
        const imageUrl = book.pages[0].imageUrl;
        const match = imageUrl.match(/\/objects\/pdf-pages\/([^/]+)\//);
        if (match) {
          const serverBookId = match[1];
          // Enqueue the deletion before attempting it. This way, if the
          // network call fails (e.g. device is offline), the entry stays in
          // the queue and is retried on the next app launch.
          AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_DELETIONS)
            .then(raw => {
              const queue: string[] = raw ? JSON.parse(raw) : [];
              if (!queue.includes(serverBookId)) {
                queue.push(serverBookId);
              }
              return AsyncStorage.setItem(
                STORAGE_KEYS.PENDING_PDF_DELETIONS,
                JSON.stringify(queue),
              );
            })
            .then(() => deletePdfPages(serverBookId))
            .then(() => {
              // Deletion succeeded — remove from the queue.
              AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_DELETIONS)
                .then(raw => {
                  const queue: string[] = raw ? JSON.parse(raw) : [];
                  const trimmed = queue.filter(bid => bid !== serverBookId);
                  return AsyncStorage.setItem(
                    STORAGE_KEYS.PENDING_PDF_DELETIONS,
                    JSON.stringify(trimmed),
                  );
                })
                .catch(() => {});
            })
            .catch(() => {
              // Deletion failed (offline or server error). The serverBookId
              // remains in PENDING_PDF_DELETIONS and will be retried on the
              // next app launch.
              console.warn(
                'deleteBook: PDF page deletion failed; will retry on next launch for bookId',
                serverBookId,
              );
            });
        }
      }

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
    sessionData: Omit<ReadingSession, 'id'>,
    opts: { bookFinished?: boolean; isPerfectQuiz?: boolean } = {}
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
      level: newLevel,
      streakCurrent: newStreak,
      streakBest: Math.max(profile.streakBest, newStreak),
      lastReadDate: today,
      totalMinutesRead: newTotalMinutes,
      totalBooksFinished: newTotalBooksFinished,
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

  /**
   * Mark a server-side bookId as "in-flight" so the orphan cleanup can find
   * it if the app is killed before the book is saved.
   */
  const registerPendingPdfImport = useCallback(async (serverBookId: string) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_PDF_IMPORTS);
      const existing: PendingPdfImport[] = raw ? JSON.parse(raw) : [];
      // Avoid duplicates (e.g. user re-renders the same PDF)
      const filtered = existing.filter(e => e.serverBookId !== serverBookId);
      filtered.push({ serverBookId, registeredAt: new Date().toISOString() });
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_PDF_IMPORTS, JSON.stringify(filtered));
    } catch (e) {
      console.warn('registerPendingPdfImport failed', e);
    }
  }, []);

  /**
   * Remove a server-side bookId from the pending list.  Call this after the
   * book is saved successfully, or after the page images have been explicitly
   * deleted (X button, back navigation).
   */
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
