import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Question } from '@/types';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, val: string) => {
      store.set(key, val);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  },
}));

import {
  getReviewQueue,
  addMissedQuestion,
  removeBookFromReviewQueue,
  processReviewResult,
} from './reviewQueue';

const sampleQ: Question = {
  type: 'recall',
  prompt: 'What is the testing effect?',
  options: ['Rereading', 'Active retrieval', 'Highlighting', 'Skimming'],
  correctIndex: 1,
  evidenceQuote: 'Pausing after a short passage to retrieve an idea',
  explanation: 'Active retrieval strengthens memory.',
  isOpenEnded: false,
};

describe('reviewQueue', () => {
  beforeEach(() => {
    store.clear();
  });

  it('deduplicates repeated misses for the same bookId and question prompt', async () => {
    await addMissedQuestion('book-1', 'Deep Reading', sampleQ, 0);
    await addMissedQuestion('book-1', 'Deep Reading', sampleQ, 2);

    const queue = await getReviewQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].originalAnswer).toBe(2);
    expect(queue[0].stage).toBe(0);
  });

  it('removes all review items for a deleted bookId', async () => {
    await addMissedQuestion('book-1', 'Deep Reading', sampleQ, 0);
    await addMissedQuestion('book-2', 'Other Book', { ...sampleQ, prompt: 'Other?' }, 3);

    await removeBookFromReviewQueue('book-1');
    const queue = await getReviewQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].bookId).toBe('book-2');
  });

  it('advances stage on correct review and graduates after stage 2', async () => {
    await addMissedQuestion('book-1', 'Deep Reading', sampleQ, 0);
    let queue = await getReviewQueue();
    const id = queue[0].id;

    await processReviewResult(id, true);
    queue = await getReviewQueue();
    expect(queue[0].stage).toBe(1);

    await processReviewResult(id, true);
    queue = await getReviewQueue();
    expect(queue[0].stage).toBe(2);

    await processReviewResult(id, true);
    queue = await getReviewQueue();
    expect(queue).toHaveLength(0);
  });
});
