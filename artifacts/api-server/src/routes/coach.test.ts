import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { TEST_USER_ID } = vi.hoisted(() => ({
  TEST_USER_ID: `test_user_${Date.now()}`,
}));

// Routes require auth and read req.user.id. Stub only the middleware so these
// tests exercise route logic; real auth behaviour is not under test here.
vi.mock('../middlewares/auth', () => ({
  requireAuth: (req: any, _res: any, next: () => void) => {
    req.user = { id: TEST_USER_ID };
    next();
  },
}));

// In-memory stand-in for the Supabase admin client. Supports only the calls
// coachMemory makes: select/eq/order/limit/single, upsert and insert.
vi.mock('../lib/supabase', () => {
  const tables: Record<string, any[]> = {};
  const rowKey = (row: any) => row.id ?? row.user_id;

  const from = (table: string) => {
    tables[table] ??= [];
    const filters: Array<[string, unknown]> = [];
    let single = false;
    let limitN: number | undefined;

    const run = () => {
      let rows = tables[table].filter((r) => filters.every(([c, v]) => r[c] === v));
      if (limitN !== undefined) rows = rows.slice(0, limitN);
      if (single) {
        return rows[0]
          ? { data: rows[0], error: null }
          : { data: null, error: { message: 'no rows' } };
      }
      return { data: rows, error: null };
    };

    const builder: any = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      order: () => builder,
      limit: (n: number) => {
        limitN = n;
        return builder;
      },
      single: () => {
        single = true;
        return builder;
      },
      upsert: (row: any) => {
        const idx = tables[table].findIndex((r) => rowKey(r) === rowKey(row));
        if (idx >= 0) tables[table][idx] = row;
        else tables[table].push(row);
        return Promise.resolve({ data: null, error: null });
      },
      insert: (rows: any) => {
        tables[table].push(...(Array.isArray(rows) ? rows : [rows]));
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  };

  return {
    getSupabaseAdmin: () => ({ from }),
    isSupabaseConfigured: () => true,
  };
});

import coachRouter from './coach';
import { applySm2, calculateReadingPace } from '../lib/coachAgent';
import { Flashcard } from '../lib/coachMemory';

const app = express();
app.use(express.json());
app.use('/api', coachRouter);

describe('Coach Agent API & Logic', () => {
  describe('SM-2 Spaced Repetition', () => {
    const baseCard: Flashcard = {
      id: 'test_card_1',
      front: 'Metacognition',
      back: 'Awareness and understanding of one’s own thought processes.',
      bookTitle: 'Thinking Fast and Slow',
      chapter: 1,
      cardType: 'concept',
      createdAt: new Date().toISOString(),
      nextReview: new Date().toISOString(),
      intervalDays: 1,
      easeFactor: 2.5,
      repetitions: 0,
    };

    it('advances repetition count and sets interval on good recall (quality 4)', () => {
      const updated = applySm2(baseCard, 4);
      expect(updated.repetitions).toBe(1);
      expect(updated.intervalDays).toBe(1); // 1st rep is 1 day
      expect(updated.easeFactor).toBeGreaterThanOrEqual(2.5);

      // 2nd rep
      const rep2 = applySm2(updated, 5);
      expect(rep2.repetitions).toBe(2);
      expect(rep2.intervalDays).toBe(6); // 2nd rep is 6 days
    });

    it('resets repetition count to 0 and interval to 1 on failure (quality < 3)', () => {
      const strongCard: Flashcard = {
        ...baseCard,
        repetitions: 3,
        intervalDays: 15,
        easeFactor: 2.6,
      };

      const failed = applySm2(strongCard, 1);
      expect(failed.repetitions).toBe(0);
      expect(failed.intervalDays).toBe(1);
    });
  });

  describe('Reading Pace Calculator', () => {
    it('calculates units per day and assesses feasibility accurately', () => {
      const pace = calculateReadingPace(10, 20, 5);
      expect(pace.unitsPerDay).toBe(2);
      expect(pace.estimatedMinutesPerSession).toBe(30);
      // 30 min > 20 * 1.25 (25) -> not feasible
      expect(pace.feasible).toBe(false);

      const feasiblePace = calculateReadingPace(10, 30, 10);
      expect(feasiblePace.unitsPerDay).toBe(1);
      expect(feasiblePace.estimatedMinutesPerSession).toBe(15);
      expect(feasiblePace.feasible).toBe(true);
    });
  });

  describe('Coach Endpoints', () => {
    const testUser = TEST_USER_ID;

    it('rejects chat request when message is empty', async () => {
      const res = await request(app)
        .post('/api/coach/chat')
        .send({ userId: testUser, message: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_INPUT');
    });

    it('successfully responds to chat message with Socratic dialogue', async () => {
      const res = await request(app)
        .post('/api/coach/chat')
        .send({
          userId: testUser,
          message: 'I am reading 1984 chapter 1. Why is the telescreen always watching?',
          bookContext: {
            title: '1984',
            chapter: 1,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBeDefined();
      expect(typeof res.body.reply).toBe('string');
      expect(res.body.strategyVersion).toBeGreaterThanOrEqual(1);
      expect(res.body.agentName).toBe('socratic_partner');
    });

    it('retrieves default strategy document', async () => {
      const res = await request(app).get(`/api/coach/strategy/${testUser}`);
      expect(res.status).toBe(200);
      expect(res.body.version).toBeDefined();
      expect(res.body.tone).toBeDefined();
      expect(res.body.effectiveTactics).toBeInstanceOf(Array);
    });

    it('triggers manual strategy evolution', async () => {
      const res = await request(app)
        .post(`/api/coach/trigger-evolution/${testUser}`)
        .send({ reason: 'Reader prefers deeper philosophical questions' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(res.body.strategy.version).toBeGreaterThan(1);
    });

    it('generates a While You Were Away digest', async () => {
      const res = await request(app).get(`/api/coach/digest/${testUser}`);
      expect(res.status).toBe(200);
      expect(res.body.digest).toBeDefined();
      expect(res.body.strategyVersion).toBeDefined();
    });

    it('creates and reviews a flashcard', async () => {
      const createRes = await request(app)
        .post(`/api/coach/flashcards/${testUser}/create`)
        .send({
          front: 'Doublethink',
          back: 'Holding two contradictory beliefs in one’s mind simultaneously.',
          bookTitle: '1984',
          chapter: 1,
          cardType: 'vocabulary',
        });

      expect(createRes.status).toBe(200);
      expect(createRes.body.id).toBeDefined();

      const reviewRes = await request(app)
        .post(`/api/coach/flashcards/${testUser}/review`)
        .send({
          cardFront: 'Doublethink',
          quality: 4,
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.success).toBe(true);
      expect(reviewRes.body.card.repetitions).toBe(1);
    });
  });
});
