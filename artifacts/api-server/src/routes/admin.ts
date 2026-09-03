import { Router } from 'express';
import { tokenBudget } from '../lib/tokenBudget';
import { aiGateway } from '../lib/aiGateway';

const router = Router();

/**
 * GET /api/admin/token-usage
 *
 * Returns current token consumption stats, cache hit rate, daily budget,
 * and recent usage entries. Useful for monitoring API cost.
 */
router.get('/admin/token-usage', (_req, res) => {
  const budgetStats = tokenBudget.getStats();
  const cacheStats = aiGateway.getCacheStats();

  res.json({
    ...budgetStats,
    ...cacheStats,
    aiAvailable: aiGateway.isAvailable,
  });
});

export default router;
