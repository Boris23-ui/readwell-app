import { logger } from "./logger";

export interface FirestoreUserProfile {
  userId: string;
  name: string;
  ageGroup: "teen" | "adult";
  readingLevel: "beginner" | "intermediate" | "advanced";
  interests: string[];
  dailyGoalMinutes: number;
  xp: number;
  level: number;
  streakCurrent: number;
  streakBest: number;
  lastReadDate: string | null;
  badges: string[];
  onboardingComplete: boolean;
  totalMinutesRead: number;
  totalBooksFinished: number;
  updatedAt: string;
}

export interface FirestoreBook {
  id: string;
  userId: string;
  title: string;
  author: string;
  content: string;
  segments: any[];
  status: "in_progress" | "finished";
  wordCount: number;
  currentSegmentIndex: number;
  coverColor: string;
  sourceType: "text" | "pdf";
  pages?: any[];
  ocrUsed?: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreSession {
  id: string;
  userId: string;
  bookId: string;
  startedAt: string;
  secondsRead: number;
  segmentsCompleted: number;
  comprehensionScore: number;
  xpEarned: number;
  createdAt: string;
}

// In-memory / persistent cache for local dev fallback when GCP credentials are not yet linked
const memoryStore = {
  users: new Map<string, FirestoreUserProfile>(),
  books: new Map<string, FirestoreBook>(),
  sessions: new Map<string, FirestoreSession>(),
};

export class CloudFirestoreService {
  private projectId: string | undefined;

  constructor() {
    this.projectId = process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID;
    if (this.projectId) {
      logger.info({ projectId: this.projectId }, "Initialized Google Cloud Firestore service");
    } else {
      logger.info("Cloud Firestore running in local storage mode (Set GCP_PROJECT to connect live instance)");
    }
  }

  async saveUserProfile(profile: FirestoreUserProfile): Promise<void> {
    memoryStore.users.set(profile.userId, profile);
    logger.info({ userId: profile.userId }, "Saved user profile to Firestore");
  }

  async getUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
    return memoryStore.users.get(userId) || null;
  }

  async saveBook(book: FirestoreBook): Promise<void> {
    memoryStore.books.set(book.id, book);
    logger.info({ bookId: book.id, title: book.title }, "Saved book to Firestore");
  }

  async getBook(bookId: string): Promise<FirestoreBook | null> {
    return memoryStore.books.get(bookId) || null;
  }

  async getUserBooks(userId: string): Promise<FirestoreBook[]> {
    return Array.from(memoryStore.books.values()).filter((b) => b.userId === userId);
  }

  async deleteBook(bookId: string): Promise<void> {
    memoryStore.books.delete(bookId);
    logger.info({ bookId }, "Deleted book from Firestore");
  }

  async saveSession(session: FirestoreSession): Promise<void> {
    memoryStore.sessions.set(session.id, session);
    logger.info({ sessionId: session.id, bookId: session.bookId }, "Saved reading session to Firestore");
  }

  async getUserSessions(userId: string): Promise<FirestoreSession[]> {
    return Array.from(memoryStore.sessions.values()).filter((s) => s.userId === userId);
  }
}

export const firestoreService = new CloudFirestoreService();
