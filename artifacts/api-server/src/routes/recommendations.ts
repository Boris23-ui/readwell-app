import { Router, type Request } from "express";
import { logger } from "../lib/logger";
import { generateContentRecommendations, RecommendationRequest } from "../lib/ml";

const router = Router();

router.post("/recommendations/generate", async (req, res) => {
  const body = req.body as Partial<RecommendationRequest>;

  const elo = typeof body.elo === 'number' ? body.elo : 100;
  const readingLevel = typeof body.readingLevel === 'string' ? body.readingLevel : 'intermediate';
  const interests = Array.isArray(body.interests) ? body.interests : [];
  const recentTopics = Array.isArray(body.recentTopics) ? body.recentTopics : [];

  try {
    const recommendations = await generateContentRecommendations({
      elo,
      readingLevel,
      interests,
      recentTopics,
    });
    
    logger.info({ elo, readingLevel }, "Generated content recommendations");
    res.json({ recommendations });
  } catch (err) {
    logger.error({ err }, "Failed to generate recommendations");
    res.status(500).json({
      error: "Internal server error during recommendation generation",
      code: "RECOMMENDATION_ERROR",
    });
  }
});

export default router;
