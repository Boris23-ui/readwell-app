import { createHash } from 'crypto';
import { logger } from './logger';
import { aiGateway } from './aiGateway';

export interface ReadingMetrics {
  comprehensionScore: number;
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
  const scoreFactor = Math.min(1.0, metrics.comprehensionScore / 100);

  // Speed factor: too fast (>400 wpm) = likely skimming; too slow (<80 wpm) = struggling
  let speedFactor = 1.0;
  if (wpm > 400) speedFactor = 0.6;
  else if (wpm < 80) speedFactor = 0.7;
  else if (wpm > 300) speedFactor = 0.85;

  // Complexity mismatch: high complexity + low ELO = lower predicted comprehension
  const complexityPenalty = Math.max(0, (metrics.complexity - 3) * 0.1) * (1 - scoreFactor);

  // Reading level bonus
  const levelBonus = metrics.readingLevel === 'advanced' ? 0.05
    : metrics.readingLevel === 'beginner' ? -0.05
    : 0;

  const predictedComprehension = Math.max(0.2, Math.min(1.0,
    (scoreFactor * 0.6 + speedFactor * 0.3 + 0.1 + levelBonus) - complexityPenalty,
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
  let promptGuidance = `ML Insight: Heuristic predicts ${(predictedComprehension * 100).toFixed(0)}% comprehension (Score ${metrics.comprehensionScore}, ${wpm.toFixed(0)} WPM, complexity ${metrics.complexity}). `;
  if (recommendedComplexityAdjust > 0.3) {
    promptGuidance += 'The user is finding this easy. Make the inference and vocabulary questions slightly more challenging.';
  } else if (recommendedComplexityAdjust < -0.3) {
    promptGuidance += 'The user might be struggling with the complexity or skimming too fast. Keep the questions highly focused on core recall facts, and simplify the vocabulary.';
  } else {
    promptGuidance += 'The user is in the optimal learning zone. Maintain the current level of difficulty.';
  }

  logger.debug(
    { score: metrics.comprehensionScore, wpm: wpm.toFixed(0), comp: predictedComprehension, adjust: recommendedComplexityAdjust },
    'Heuristic comprehension evaluation',
  );

  return {
    predictedComprehension,
    recommendedComplexityAdjust,
    promptGuidance,
  };
}



