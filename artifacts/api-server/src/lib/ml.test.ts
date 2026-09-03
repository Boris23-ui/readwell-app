import { describe, it, expect } from 'vitest';
import { evaluateComprehension } from './ml';

describe('evaluateComprehension (Local Heuristic)', () => {
  it('should return a higher predicted comprehension for low complexity and high ELO', () => {
    const insight = evaluateComprehension({
      elo: 3000,
      secondsRead: 120,
      wordCount: 300,
      complexity: 2.0,
      readingLevel: 'advanced'
    });
    
    // advanced + 3000 ELO + low complexity + 150 WPM (2.5 words/sec)
    // Should be fairly high comprehension
    expect(insight.predictedComprehension).toBeGreaterThan(0.7);
  });

  it('should return a lower predicted comprehension for high complexity and low ELO', () => {
    const insight = evaluateComprehension({
      elo: 500,
      secondsRead: 60,
      wordCount: 400,
      complexity: 4.5,
      readingLevel: 'beginner'
    });
    
    // beginner + 500 ELO + high complexity + 400 WPM (very fast, rushing)
    expect(insight.predictedComprehension).toBeLessThan(0.7);
  });

  it('should generate valid prompt guidance string', () => {
    const insight = evaluateComprehension({
      elo: 1000,
      secondsRead: 60,
      wordCount: 150,
      complexity: 2.5,
      readingLevel: 'intermediate'
    });
    
    expect(insight.promptGuidance).toContain('ML Insight: Heuristic predicts');
    expect(insight.recommendedComplexityAdjust).toBeDefined();
  });
});
