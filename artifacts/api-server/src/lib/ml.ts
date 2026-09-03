import { createHash } from 'crypto';
import { logger } from './logger';
import { aiGateway } from './aiGateway';

export interface ReadingMetrics {
  elo: number;
  secondsRead: number;
  wordCount: number;
  complexity: number;
  readingLevel: string;
}

export interface MLInsight {
  predictedComprehension: number; // 0.0 to 1.0
  recommendedComplexityAdjust: number; // -1.0 to 1.0
  promptGuidance: string;
}

/**
 * Pure-heuristic comprehension evaluation.
 * Replaces the previous Gemini API call — this function maps 4 numeric inputs
 * (ELO, WPM, complexity, reading level) to 2 numeric outputs. An LLM is
 * dramatically overkill for this; a deterministic formula gives equivalent
 * results at zero token cost.
 */
export function evaluateComprehension(metrics: ReadingMetrics): MLInsight {
  const wpm = metrics.secondsRead > 0
    ? (metrics.wordCount / metrics.secondsRead) * 60
    : 150; // default WPM if no timing data

  // ELO-based baseline comprehension (normalized 0–5000 → 0.0–1.0)
  const eloFactor = Math.min(1.0, metrics.elo / 3000);

  // Speed factor: too fast (>400 wpm) = likely skimming; too slow (<80 wpm) = struggling
  let speedFactor = 1.0;
  if (wpm > 400) speedFactor = 0.6;
  else if (wpm < 80) speedFactor = 0.7;
  else if (wpm > 300) speedFactor = 0.85;

  // Complexity mismatch: high complexity + low ELO = lower predicted comprehension
  const complexityPenalty = Math.max(0, (metrics.complexity - 3) * 0.1) * (1 - eloFactor);

  // Reading level bonus
  const levelBonus = metrics.readingLevel === 'advanced' ? 0.05
    : metrics.readingLevel === 'beginner' ? -0.05
    : 0;

  const predictedComprehension = Math.max(0.2, Math.min(1.0,
    (eloFactor * 0.6 + speedFactor * 0.3 + 0.1 + levelBonus) - complexityPenalty,
  ));

  // Difficulty adjustment: push harder if comprehension is high, ease off if low
  let recommendedComplexityAdjust: number;
  if (predictedComprehension > 0.85) {
    recommendedComplexityAdjust = 0.5;
  } else if (predictedComprehension > 0.7) {
    recommendedComplexityAdjust = 0.2;
  } else if (predictedComprehension < 0.35) {
    recommendedComplexityAdjust = -0.5;
  } else if (predictedComprehension < 0.5) {
    recommendedComplexityAdjust = -0.3;
  } else {
    recommendedComplexityAdjust = 0.0;
  }

  // Build prompt guidance string for downstream quiz generation
  let promptGuidance = `ML Insight: Heuristic predicts ${(predictedComprehension * 100).toFixed(0)}% comprehension (ELO ${metrics.elo}, ${wpm.toFixed(0)} WPM, complexity ${metrics.complexity}). `;
  if (recommendedComplexityAdjust > 0.3) {
    promptGuidance += 'The user is finding this easy. Make the inference and vocabulary questions slightly more challenging.';
  } else if (recommendedComplexityAdjust < -0.3) {
    promptGuidance += 'The user might be struggling with the complexity or skimming too fast. Keep the questions highly focused on core recall facts, and simplify the vocabulary.';
  } else {
    promptGuidance += 'The user is in the optimal learning zone. Maintain the current level of difficulty.';
  }

  logger.debug(
    { elo: metrics.elo, wpm: wpm.toFixed(0), comp: predictedComprehension, adjust: recommendedComplexityAdjust },
    'Heuristic comprehension evaluation',
  );

  return {
    predictedComprehension,
    recommendedComplexityAdjust,
    promptGuidance,
  };
}

export interface RecommendationRequest {
  elo: number;
  readingLevel: string;
  interests: string[];
  recentTopics: string[];
}

export interface RecommendedContent {
  title: string;
  topic: string;
  reason: string;
  estimatedComplexity: number;
}

export async function generateContentRecommendations(req: RecommendationRequest): Promise<RecommendedContent[]> {
  const fallback: RecommendedContent[] = [
    {
      title: "The History of Space Exploration",
      topic: "Science",
      reason: "Matches your interest in technology and fits your reading level.",
      estimatedComplexity: 2.5,
    },
    {
      title: "Introduction to Financial Literacy",
      topic: "Finance",
      reason: "A great next step to build your foundational knowledge.",
      estimatedComplexity: 2.8,
    },
    {
      title: "The Psychology of Habit Formation",
      topic: "Psychology",
      reason: "Connects to your reading habit journey and builds self-awareness.",
      estimatedComplexity: 2.3,
    },
  ];

  // Build a stable cache key from the user profile signature
  const profileHash = createHash('sha256')
    .update(JSON.stringify({
      eloBucket: Math.floor(req.elo / 500) * 500, // bucket ELO to increase cache hits
      readingLevel: req.readingLevel,
      interests: [...req.interests].sort(),
      recentTopics: [...req.recentTopics].sort(),
    }))
    .digest('hex')
    .slice(0, 16);

  const prompt = `Student Profile:
- ELO Score (0-5000): ${req.elo}
- Target Reading Level: ${req.readingLevel}
- Expressed Interests: ${req.interests.join(", ") || "General knowledge"}
- Recently Read Topics: ${req.recentTopics.join(", ") || "None"}`;

  const systemInstruction = 'You are an AI reading tutor. Recommend exactly 3 specific book topics or reading areas. Return a JSON array of objects with fields: title (string), topic (string), reason (string), estimatedComplexity (number 1.0–5.0).';

  try {
    const result = await aiGateway.generate({
      purpose: 'recommendation',
      priority: 'optional',
      cacheKey: `rec:${profileHash}`,
      cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
      prompt,
      systemInstruction,
      maxOutputTokens: 600,
      fallbackFn: () => JSON.stringify(fallback),
    });

    const parsed = JSON.parse(result.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        title: String(item.title || "Recommended Reading"),
        topic: String(item.topic || "General"),
        reason: String(item.reason || "Recommended for your reading level."),
        estimatedComplexity: Number(item.estimatedComplexity) || 2.5,
      }));
    }
    return fallback;
  } catch (error) {
    logger.warn({ err: error }, 'Recommendation generation failed, using fallback');
    return fallback;
  }
}

