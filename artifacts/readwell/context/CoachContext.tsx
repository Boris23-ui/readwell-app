import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useApp } from './CloudAppContext';
import {
  CoachMessage,
  StrategyDoc,
  Flashcard,
  CoachDigest,
  Book,
} from '@/types';
import {
  chatWithCoach,
  fetchCoachStrategy,
  fetchCoachDigest,
  fetchCoachFlashcards,
  reviewCoachFlashcard,
  createCoachFlashcard,
  triggerCoachEvolution,
} from '@/utils/api';

const CACHE_COACH_MESSAGES = '@readwell/coach-messages';
const CACHE_COACH_DIGEST_DISMISSED = '@readwell/coach-digest-dismissed';

interface CoachContextType {
  messages: CoachMessage[];
  strategy: StrategyDoc | null;
  digest: CoachDigest | null;
  flashcards: Flashcard[];
  dueFlashcards: Flashcard[];
  isLoading: boolean;
  isSending: boolean;
  selectedBook: Book | null;
  setSelectedBook: (book: Book | null) => void;
  sendMessage: (text: string, customBookContext?: CoachMessage['bookContext']) => Promise<void>;
  reviewCard: (cardId: string, quality: number, front?: string) => Promise<void>;
  addCard: (card: { front: string; back: string; bookTitle?: string; chapter?: number; cardType?: Flashcard['cardType'] }) => Promise<void>;
  evolveStrategy: (reason?: string) => Promise<void>;
  dismissDigest: () => void;
  refreshFlashcards: () => Promise<void>;
  refreshStrategy: () => Promise<void>;
  clearConversation: () => Promise<void>;
}

const CoachContext = createContext<CoachContextType | null>(null);

const DEFAULT_STRATEGY: StrategyDoc = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  tone: 'Encouraging, intellectual, Socratic',
  difficultyLevel: 0.5,
  preferredQuestionStyle: 'Open-ended Socratic with personal reflection',
  effectiveTactics: ['Connect themes across books', 'Real-world analogies', 'Personal reflection hooks'],
  ineffectiveTactics: ['Pop-quiz interrogation', 'Long lectures'],
  sessionPace: '10-15 minute check-ins',
  evolutionHistory: [],
};

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { books } = useApp();

  const userId = user?.uid || 'learner_reader';

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [strategy, setStrategy] = useState<StrategyDoc | null>(DEFAULT_STRATEGY);
  const [digest, setDigest] = useState<CoachDigest | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Default selected book to the first in-progress book
  useEffect(() => {
    if (!selectedBook && books.length > 0) {
      const active = books.find(b => b.status === 'in_progress') || books[0];
      setSelectedBook(active);
    }
  }, [books, selectedBook]);

  // Load cached messages & remote strategy/digest on mount
  useEffect(() => {
    let mounted = true;

    const initCoach = async () => {
      try {
        // 1. Load cached messages
        const cached = await AsyncStorage.getItem(`${CACHE_COACH_MESSAGES}_${userId}`);
        if (cached && mounted) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
            }
          } catch {
            // ignore
          }
        }

        // 2. Fetch Strategy & Flashcards
        const [stratRes, cardsRes, digestRes] = await Promise.allSettled([
          fetchCoachStrategy(userId),
          fetchCoachFlashcards(userId),
          fetchCoachDigest(userId),
        ]);

        if (mounted && stratRes.status === 'fulfilled' && stratRes.value) {
          setStrategy(stratRes.value);
        }

        if (mounted && cardsRes.status === 'fulfilled' && cardsRes.value) {
          setFlashcards(cardsRes.value.allCards || []);
        }

        if (mounted && digestRes.status === 'fulfilled' && digestRes.value) {
          const d = digestRes.value;
          const dismissedDate = await AsyncStorage.getItem(`${CACHE_COACH_DIGEST_DISMISSED}_${userId}`);
          const today = new Date().toISOString().split('T')[0];
          if (dismissedDate !== today && d.daysAway && d.daysAway >= 1) {
            setDigest(d);
          }
        }
      } catch (err) {
        console.warn('Coach initialization notice:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initCoach();
    return () => { mounted = false; };
  }, [userId]);

  // Save messages to cache whenever they update
  const persistMessages = useCallback(async (newMessages: CoachMessage[]) => {
    try {
      await AsyncStorage.setItem(`${CACHE_COACH_MESSAGES}_${userId}`, JSON.stringify(newMessages));
    } catch (err) {
      console.warn('Failed to cache coach messages', err);
    }
  }, [userId]);

  const refreshStrategy = useCallback(async () => {
    try {
      const s = await fetchCoachStrategy(userId);
      setStrategy(s);
    } catch (err) {
      console.warn('Could not refresh coach strategy', err);
    }
  }, [userId]);

  const refreshFlashcards = useCallback(async () => {
    try {
      const res = await fetchCoachFlashcards(userId);
      setFlashcards(res.allCards || []);
    } catch (err) {
      console.warn('Could not refresh coach flashcards', err);
    }
  }, [userId]);

  const sendMessage = useCallback(async (
    text: string,
    customBookContext?: CoachMessage['bookContext'],
  ) => {
    if (!text.trim() || isSending) return;

    const userMsg: CoachMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
      bookContext: customBookContext || (selectedBook ? {
        bookId: selectedBook.id,
        title: selectedBook.title,
        chapter: selectedBook.currentSegmentIndex + 1,
      } : undefined),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsSending(true);

    try {
      const bookContext = userMsg.bookContext ? {
        bookId: userMsg.bookContext.bookId,
        title: userMsg.bookContext.title,
        chapter: userMsg.bookContext.chapter,
      } : undefined;

      const result = await chatWithCoach({
        userId,
        message: userMsg.content,
        bookContext,
      });

      const assistantMsg: CoachMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        timestamp: new Date().toISOString(),
        strategyVersion: result.strategyVersion,
        agentName: result.agentName,
        intent: result.intent,
        bookContext: userMsg.bookContext,
      };

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      persistMessages(finalMessages);

      if (result.evolved) {
        refreshStrategy();
      }
      refreshFlashcards();
    } catch (err) {
      console.error('Failed to send coach message', err);
      const fallbackMsg: CoachMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: "I'm having a brief connection pause, but I'm right here with your book! Tell me what you're thinking about this chapter.",
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...nextMessages, fallbackMsg];
      setMessages(finalMessages);
      persistMessages(finalMessages);
    } finally {
      setIsSending(false);
    }
  }, [userId, isSending, messages, selectedBook, persistMessages, refreshStrategy, refreshFlashcards]);

  const reviewCard = useCallback(async (cardId: string, quality: number, front?: string) => {
    try {
      await reviewCoachFlashcard(userId, cardId, quality, front);
      await refreshFlashcards();
    } catch (err) {
      console.warn('Failed to review card', err);
    }
  }, [userId, refreshFlashcards]);

  const addCard = useCallback(async (card: {
    front: string;
    back: string;
    bookTitle?: string;
    chapter?: number;
    cardType?: Flashcard['cardType'];
  }) => {
    try {
      await createCoachFlashcard(userId, {
        front: card.front,
        back: card.back,
        bookTitle: card.bookTitle || selectedBook?.title || 'General',
        chapter: card.chapter || (selectedBook ? selectedBook.currentSegmentIndex + 1 : 1),
        cardType: card.cardType || 'concept',
      });
      await refreshFlashcards();
    } catch (err) {
      console.warn('Failed to add flashcard', err);
    }
  }, [userId, selectedBook, refreshFlashcards]);

  const evolveStrategy = useCallback(async (reason?: string) => {
    try {
      await triggerCoachEvolution(userId, reason);
      await refreshStrategy();
    } catch (err) {
      console.warn('Failed to evolve strategy', err);
    }
  }, [userId, refreshStrategy]);

  const dismissDigest = useCallback(async () => {
    setDigest(null);
    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(`${CACHE_COACH_DIGEST_DISMISSED}_${userId}`, today);
  }, [userId]);

  const clearConversation = useCallback(async () => {
    setMessages([]);
    await AsyncStorage.removeItem(`${CACHE_COACH_MESSAGES}_${userId}`);
  }, [userId]);

  const nowIso = new Date().toISOString();
  const dueFlashcards = flashcards.filter(c => c.nextReview <= nowIso);

  return (
    <CoachContext.Provider
      value={{
        messages,
        strategy,
        digest,
        flashcards,
        dueFlashcards,
        isLoading,
        isSending,
        selectedBook,
        setSelectedBook,
        sendMessage,
        reviewCard,
        addCard,
        evolveStrategy,
        dismissDigest,
        refreshFlashcards,
        refreshStrategy,
        clearConversation,
      }}
    >
      {children}
    </CoachContext.Provider>
  );
}

export function useCoach() {
  const ctx = useContext(CoachContext);
  if (!ctx) {
    throw new Error('useCoach must be used within a CoachProvider');
  }
  return ctx;
}
