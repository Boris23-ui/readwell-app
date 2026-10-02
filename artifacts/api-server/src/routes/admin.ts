import { Router } from 'express';
import { tokenBudget } from '../lib/tokenBudget';
import { aiGateway } from '../lib/aiGateway';
import { objectStorageClient, ObjectStorageService, parseObjectPath } from '../lib/objectStorage';

const router = Router();
const objectStorageService = new ObjectStorageService();

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

/**
 * GET /api/admin/storage-stats
 *
 * Returns current object storage usage for PDF pages (count and bytes).
 * Useful for monitoring storage cost and orphan cleanup effectiveness.
 */
router.get('/admin/storage-stats', async (_req, res) => {
  try {
    let entityDir = objectStorageService.getPrivateObjectDir();
    if (!entityDir.endsWith('/')) {
      entityDir = `${entityDir}/`;
    }
    const prefix = `${entityDir}pdf-pages/`;
    
    const { bucketName, objectName } = parseObjectPath(prefix);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: objectName });
    
    let totalBytes = 0;
    const bookIds = new Set<string>();
    
    for (const file of files) {
      totalBytes += Number(file.metadata?.size || 0);
      const afterPrefix = file.name.slice(objectName.length);
      const bookId = afterPrefix.split('/')[0];
      if (bookId) {
        bookIds.add(bookId);
      }
    }

    res.json({
      status: 'success',
      totalFiles: files.length,
      totalBytes,
      totalBooksStored: bookIds.size,
      prefix: objectName,
    });
  } catch (err) {
    console.error('Storage stats error:', err);
    res.status(500).json({ error: 'Failed to fetch storage stats' });
  }
});

export default router;
