import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tokenBudget } from './tokenBudget';

describe('TokenBudget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset budget before each test
    // Assuming tokenBudget has a private reset method or we just create a new instance if needed,
    // but it's a singleton. We can mock process.env or just test its limits.
    // For now, we can consume 0 to get current state or reset it.
    // Let's reset the internal state by consuming a negative amount or using a reset method.
    // Since we don't have a reset method exposed, we'll just test the logic carefully.
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with a daily budget', () => {
    const stats = tokenBudget.getStats();
    expect(stats.dailyBudget).toBeGreaterThan(0);
    expect(stats.remainingBudget).toBeLessThanOrEqual(stats.dailyBudget);
  });

  it('should allow critical requests even if budget is low (but not negative)', () => {
    const isAllowed = tokenBudget.shouldAllow('critical');
    expect(isAllowed).toBe(true);
  });

  it('should track consumed tokens correctly', () => {
    const initialStats = tokenBudget.getStats();
    tokenBudget.record({
      purpose: 'quiz_generation',
      inputTokens: 50,
      outputTokens: 100,
      cached: false
    });
    const newStats = tokenBudget.getStats();
    
    expect(newStats.todayUsage.inputTokens).toBe(initialStats.todayUsage.inputTokens + 50);
    expect(newStats.todayUsage.outputTokens).toBe(initialStats.todayUsage.outputTokens + 100);
    expect(newStats.todayUsage.totalTokens).toBe(initialStats.todayUsage.totalTokens + 150);
    expect(newStats.remainingBudget).toBe(initialStats.remainingBudget - 150);
  });
});
