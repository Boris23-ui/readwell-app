import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../middlewares/auth';
import { logger } from '../lib/logger';
import {
  coachMemory,
  Flashcard,
} from '../lib/coachMemory';
import {
  chatWithCoach,
  generateCoachDigest,
  triggerStrategyEvolution,
  searchGoogleBooks,
  calculateReadingPace,
  createReadingPlan,
  applySm2,
  explainCoachEvolution,
} from '../lib/coachAgent';

const router = Router();

// Helper removed since we use req.user.id

// ── 1. Chat with the Coach ───────────────────────────────────────────────────
router.post('/coach/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as {
    userId?: string;
    message?: string;
    bookContext?: {
      bookId?: string;
      title?: string;
      author?: string;
      chapter?: number;
      segmentText?: string;
    };
  };

  const userId = req.user!.id;
  const message = body.message?.trim();

  if (!message) {
    res.status(400).json({ error: 'message is required', code: 'INVALID_INPUT' });
    return;
  }

  try {
    const result = await chatWithCoach({
      userId,
      message,
      bookContext: body.bookContext,
    });
    res.json(result);
  } catch (err) {
    logger.error({ err, userId }, 'Coach chat failed');
    res.status(500).json({
      error: 'Coach dialogue temporarily failed. Please try again.',
      code: 'COACH_CHAT_ERROR',
    });
  }
});

// ── 2. Profile Management ────────────────────────────────────────────────────
router.get('/coach/profile/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const profile = await coachMemory.getProfile(userId);
    res.json(profile);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch coach profile');
    res.status(500).json({ error: 'Failed to fetch coach profile' });
  }
});

router.post('/coach/profile/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const updates = req.body;
  try {
    const profile = await coachMemory.getProfile(userId);
    const updated = { ...profile, ...updates, userId };
    await coachMemory.saveProfile(updated);
    res.json(updated);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to save coach profile');
    res.status(500).json({ error: 'Failed to save coach profile' });
  }
});

// ── 3. Strategy Document & Evolution History ─────────────────────────────────
router.get('/coach/strategy/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const strategy = await coachMemory.getStrategy(userId);
    res.json(strategy);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch coach strategy');
    res.status(500).json({ error: 'Failed to fetch strategy' });
  }
});

router.get('/coach/evolution/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const strategy = await coachMemory.getStrategy(userId);
    const explanation = await explainCoachEvolution(userId);
    res.json({
      currentVersion: strategy.version,
      tone: strategy.tone,
      difficultyLevel: strategy.difficultyLevel,
      preferredQuestionStyle: strategy.preferredQuestionStyle,
      effectiveTactics: strategy.effectiveTactics,
      ineffectiveTactics: strategy.ineffectiveTactics,
      history: strategy.evolutionHistory,
      explanation,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch evolution history');
    res.status(500).json({ error: 'Failed to fetch evolution' });
  }
});

router.post('/coach/trigger-evolution/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const reason = (req.body as any)?.reason;
  try {
    const result = await triggerStrategyEvolution(userId, reason);
    res.json({
      status: 'completed',
      updated: result.updated,
      strategy: result.strategy,
      record: result.record,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to trigger strategy evolution');
    res.status(500).json({ error: 'Failed to trigger evolution' });
  }
});

// ── 4. "While You Were Away" Digest ──────────────────────────────────────────
router.get('/coach/digest/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const digestData = await generateCoachDigest(userId);
    res.json(digestData);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to generate coach digest');
    res.status(500).json({ error: 'Failed to generate digest' });
  }
});

// ── 5. Spaced Repetition Flashcards ──────────────────────────────────────────
router.get('/coach/flashcards/:userId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const all = await coachMemory.getFlashcards(userId);
    const nowIso = new Date().toISOString();
    const due = all.filter(c => c.nextReview <= nowIso);
    res.json({
      total: all.length,
      dueCount: due.length,
      dueCards: due,
      allCards: all,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch flashcards');
    res.status(500).json({ error: 'Failed to fetch flashcards' });
  }
});

router.post('/coach/flashcards/:userId/create', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const body = req.body as Partial<Flashcard>;

  if (!body.front || !body.back) {
    res.status(400).json({ error: 'front and back are required' });
    return;
  }

  const card: Flashcard = {
    id: body.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    front: body.front.trim(),
    back: body.back.trim(),
    bookTitle: body.bookTitle || 'Reading',
    chapter: body.chapter || 1,
    cardType: body.cardType || 'concept',
    createdAt: new Date().toISOString(),
    nextReview: new Date().toISOString(),
    intervalDays: 1,
    easeFactor: 2.5,
    repetitions: 0,
  };

  try {
    await coachMemory.saveFlashcard(userId, card);
    res.json(card);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to create flashcard');
    res.status(500).json({ error: 'Failed to create flashcard' });
  }
});

router.post('/coach/flashcards/:userId/review', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { cardId, cardFront, quality } = req.body as {
    cardId?: string;
    cardFront?: string;
    quality?: number;
  };

  const q = typeof quality === 'number' ? Math.max(0, Math.min(5, quality)) : 3;

  try {
    const cards = await coachMemory.getFlashcards(userId);
    const target = cards.find(
      c => (cardId && c.id === cardId) || (cardFront && c.front.toLowerCase() === cardFront.toLowerCase())
    );

    if (!target) {
      res.status(404).json({ error: 'Flashcard not found' });
      return;
    }

    const updated = applySm2(target, q);
    await coachMemory.saveFlashcard(userId, updated);

    res.json({
      success: true,
      card: updated,
      message: `Card scheduled for review in ${updated.intervalDays} day(s).`,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to review flashcard');
    res.status(500).json({ error: 'Failed to review flashcard' });
  }
});

// ── 6. Reading Plans & Pace ──────────────────────────────────────────────────
router.post('/coach/plan/calculate', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { totalUnits, availableMinutes, targetDays } = req.body;
  const result = calculateReadingPace(
    Number(totalUnits) || 10,
    Number(availableMinutes) || 20,
    Number(targetDays) || 14
  );
  res.json(result);
});

router.post('/coach/plan/create', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { bookTitle, totalChapters, targetDays, availableMinutes } = req.body;
  const userId = req.user!.id;
  try {
    const plan = await createReadingPlan(
      userId,
      bookTitle || 'Untitled Book',
      Number(totalChapters) || 10,
      Number(targetDays) || 14,
      Number(availableMinutes) || 20
    );
    res.json(plan);
  } catch (err) {
    logger.error({ err }, 'Failed to create reading plan');
    res.status(500).json({ error: 'Failed to create reading plan' });
  }
});

// ── 7. Google Books Search ───────────────────────────────────────────────────
router.get('/coach/books/search', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.status(400).json({ error: 'Query q is required' });
    return;
  }
  const maxResults = Math.min(10, Number(req.query.maxResults) || 5);
  const results = await searchGoogleBooks(q, maxResults);
  res.json({ results });
});

export default router;
