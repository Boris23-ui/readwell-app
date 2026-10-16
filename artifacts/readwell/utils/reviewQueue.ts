import AsyncStorage from '@react-native-async-storage/async-storage';
import { Question } from '@/types';

import { parseStoredJson, isArray } from './safeStorage';

export interface ReviewItem {
  id: string;
  bookId: string;
  bookTitle: string;
  question: Question;
  originalAnswer: number;
  addedAt: string;
  nextReviewAt: string;
  stage: number; // 0 = 2 days, 1 = 7 days, 2 = 30 days
}

const REVIEW_QUEUE_KEY = '@readwell/review-queue';

function isValidReviewItem(item: unknown): item is ReviewItem {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.bookId === 'string' &&
    typeof r.nextReviewAt === 'string' &&
    typeof r.stage === 'number' &&
    Boolean(r.question && typeof r.question === 'object')
  );
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function getReviewQueue(): Promise<ReviewItem[]> {
  try {
    const data = await AsyncStorage.getItem(REVIEW_QUEUE_KEY);
    const { value } = parseStoredJson<unknown[]>(data, [], isArray);
    return value.filter(isValidReviewItem);
  } catch {
    return [];
  }
}

export async function addMissedQuestion(bookId: string, bookTitle: string, question: Question, originalAnswer: number): Promise<void> {
  const queue = await getReviewQueue();
  
  // Calculate next review (2 days from now)
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 2);
  
  const newItem: ReviewItem = {
    id: generateId(),
    bookId,
    bookTitle,
    question,
    originalAnswer,
    addedAt: new Date().toISOString(),
    nextReviewAt: nextDate.toISOString(),
    stage: 0,
  };
  
  queue.push(newItem);
  await AsyncStorage.setItem(REVIEW_QUEUE_KEY, JSON.stringify(queue));
}

export async function getDueReviews(limit = 5): Promise<ReviewItem[]> {
  const queue = await getReviewQueue();
  const now = new Date().toISOString();
  
  return queue
    .filter(item => item.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt))
    .slice(0, limit);
}

export async function processReviewResult(itemId: string, correct: boolean): Promise<void> {
  const queue = await getReviewQueue();
  const idx = queue.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  
  const item = queue[idx];
  
  if (correct) {
    if (item.stage === 0) {
      item.stage = 1;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7);
      item.nextReviewAt = nextDate.toISOString();
    } else if (item.stage === 1) {
      item.stage = 2;
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 30);
      item.nextReviewAt = nextDate.toISOString();
    } else {
      queue.splice(idx, 1);
    }
  } else {
    item.stage = 0;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    item.nextReviewAt = nextDate.toISOString();
  }
  
  await AsyncStorage.setItem(REVIEW_QUEUE_KEY, JSON.stringify(queue));
}
