import { logger } from './logger';

export interface TokenUsageEntry {
  purpose: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
  cached: boolean;
}

export type AIPriority = 'critical' | 'standard' | 'optional';

const MAX_ENTRIES = 1000;
const DEFAULT_DAILY_BUDGET = 50_000;

class TokenBudget {
  private entries: TokenUsageEntry[] = [];
  private dailyBudget: number;

  constructor() {
    const envBudget = process.env.TOKEN_DAILY_BUDGET;
    this.dailyBudget = envBudget ? Number(envBudget) : DEFAULT_DAILY_BUDGET;
    if (isNaN(this.dailyBudget) || this.dailyBudget <= 0) {
      this.dailyBudget = DEFAULT_DAILY_BUDGET;
    }
  }

  /** Record a completed AI call's token usage. */
  record(entry: Omit<TokenUsageEntry, 'timestamp'>): void {
    const full: TokenUsageEntry = { ...entry, timestamp: Date.now() };
    this.entries.push(full);
    // Evict oldest entries beyond ring buffer size
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
  }

  /** Get total tokens consumed today (UTC day boundary). */
  getTodayUsage(): { inputTokens: number; outputTokens: number; totalTokens: number } {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const cutoff = startOfDay.getTime();

    let inputTokens = 0;
    let outputTokens = 0;
    for (const e of this.entries) {
      if (e.timestamp >= cutoff && !e.cached) {
        inputTokens += e.inputTokens;
        outputTokens += e.outputTokens;
      }
    }
    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  /** Check whether a request at the given priority should be allowed through. */
  shouldAllow(priority: AIPriority): boolean {
    const { totalTokens } = this.getTodayUsage();

    if (totalTokens >= this.dailyBudget) {
      if (priority === 'critical') {
        logger.warn(
          { totalTokens, dailyBudget: this.dailyBudget },
          'Daily token budget exceeded but allowing critical request',
        );
        return true;
      }
      logger.info(
        { totalTokens, dailyBudget: this.dailyBudget, priority },
        'Daily token budget exceeded — routing to fallback',
      );
      return false;
    }

    // Soft threshold at 80%: block 'optional' requests early
    if (priority === 'optional' && totalTokens >= this.dailyBudget * 0.8) {
      logger.info(
        { totalTokens, threshold: this.dailyBudget * 0.8, priority },
        'Approaching daily budget — blocking optional request',
      );
      return false;
    }

    return true;
  }

  /** Return a snapshot of usage stats for the admin endpoint. */
  getStats(): {
    dailyBudget: number;
    todayUsage: ReturnType<TokenBudget['getTodayUsage']>;
    remainingBudget: number;
    recentEntries: TokenUsageEntry[];
    cacheHitRate: string;
  } {
    const todayUsage = this.getTodayUsage();
    const recentEntries = this.entries.slice(-20);
    const todayEntries = this.entries.filter(e => {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      return e.timestamp >= startOfDay.getTime();
    });
    const cachedCount = todayEntries.filter(e => e.cached).length;
    const cacheHitRate = todayEntries.length > 0
      ? `${((cachedCount / todayEntries.length) * 100).toFixed(1)}%`
      : 'N/A';

    return {
      dailyBudget: this.dailyBudget,
      todayUsage,
      remainingBudget: Math.max(0, this.dailyBudget - todayUsage.totalTokens),
      recentEntries,
      cacheHitRate,
    };
  }
}

/** Singleton token budget tracker. */
export const tokenBudget = new TokenBudget();
