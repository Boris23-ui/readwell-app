import { describe, expect, it } from 'vitest';
import {
  calculateReadingMinutes,
  calculateSessionXp,
  getLevelFromXp,
  getXpProgressInLevel,
} from './xp';

describe('calculateReadingMinutes', () => {
  it('returns 0 for very brief skips (< 15 seconds)', () => {
    expect(calculateReadingMinutes(0)).toBe(0);
    expect(calculateReadingMinutes(14)).toBe(0);
    expect(calculateReadingMinutes(-5)).toBe(0);
  });

  it('credits 1 minute for a genuine short segment (15–89 seconds)', () => {
    expect(calculateReadingMinutes(15)).toBe(1);
    expect(calculateReadingMinutes(45)).toBe(1);
    expect(calculateReadingMinutes(80)).toBe(1);
  });

  it('rounds longer sessions to the nearest minute', () => {
    expect(calculateReadingMinutes(120)).toBe(2);
    expect(calculateReadingMinutes(155)).toBe(3);
  });
});

describe('calculateSessionXp', () => {
  it('awards reading XP + quiz XP + perfect bonus + daily goal + book finish bonuses', () => {
    // 10 min read (10) + quiz base (10) + 4*2 (8) + perfect (5) + daily goal (25) + book finished (100) = 158
    expect(calculateSessionXp(10, 4, 4, true, true)).toBe(158);
  });

  it('does NOT award quiz base or perfect bonus when quizTotal is 0 (skipped)', () => {
    expect(calculateSessionXp(5, 0, 0, false, false)).toBe(5);
    expect(calculateSessionXp(0, 0, 0, false, false)).toBe(0);
  });

  it('caps daily reading-minute XP at 60', () => {
    expect(calculateSessionXp(120, 0, 0, false, false)).toBe(60);
  });

  it('computes levels and progress monotonically', () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(100)).toBe(2);
    const prog = getXpProgressInLevel(50);
    expect(prog.current).toBe(50);
    expect(prog.required).toBe(100);
    expect(prog.percent).toBeCloseTo(0.5);
  });
});
