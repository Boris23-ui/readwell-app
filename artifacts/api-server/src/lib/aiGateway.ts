import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';
import { logger } from './logger';
import { tokenBudget, type AIPriority } from './tokenBudget';

// ── LRU Cache ────────────────────────────────────────────────────────────────

interface CacheEntry {
  value: string;
  expiresAt: number;
}

class LRUCache {
  private map = new Map<string, CacheEntry>();
  private readonly maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  get(key: string): string | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string, ttlMs: number): void {
    // Evict if at capacity
    if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

// ── AI Gateway ───────────────────────────────────────────────────────────────

export type AIPurpose = 'quiz' | 'simplify' | 'comprehension' | 'recommendation' | 'coach';

export interface AIRequest {
  purpose: AIPurpose;
  priority: AIPriority;
  /** Explicit cache key. If omitted, one is auto-generated from prompt + purpose. */
  cacheKey?: string;
  /** Cache TTL in ms. Defaults vary by purpose. Set to 0 to skip caching. */
  cacheTtlMs?: number;
  prompt: string;
  systemInstruction: string;
  responseSchema?: object;
  responseMimeType?: string;
  maxOutputTokens: number;
  temperature?: number;
  /** Explicit model override. If omitted, uses agent preview model for coach, or standard model for others. */
  model?: string;
  /** Synchronous fallback function if AI is unavailable or budget-blocked. */
  fallbackFn?: () => string;
}

export interface AIResponse {
  text: string;
  cached: boolean;
  inputTokens: number;
  outputTokens: number;
  purpose: AIPurpose;
}

const DEFAULT_TTL: Record<AIPurpose, number> = {
  quiz: 60 * 60 * 1000,           // 1 hour
  simplify: 24 * 60 * 60 * 1000,  // 24 hours
  comprehension: 0,                // no caching (replaced by heuristic)
  recommendation: 24 * 60 * 60 * 1000, // 24 hours
  coach: 0,                        // never cache chat responses
};

const GEMINI_TIMEOUT_MS = 30_000;

class AIGateway {
  private client: GoogleGenAI | null = null;
  private modelName: string;
  private agentModelName: string;
  private cache = new LRUCache(200);
  private initialized = false;

  constructor() {
    this.modelName = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    this.agentModelName = process.env.GEMINI_AGENT_MODEL || 'gemini-3-flash-preview';
    this.init();
  }

  private init(): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.info('AIGateway: No GEMINI_API_KEY — all requests will use fallbacks');
      return;
    }
    try {
      this.client = new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: GEMINI_TIMEOUT_MS,
          retryOptions: { attempts: 1 },
        },
      });
      this.initialized = true;
      logger.info(
        { generalModel: this.modelName, agentModel: this.agentModelName },
        'AIGateway: Initialized with shared Gemini client',
      );
    } catch (err) {
      logger.warn({ err }, 'AIGateway: Failed to initialize Gemini client');
    }
  }

  /** Check whether the gateway has a live Gemini client. */
  get isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  /** Generate a cache key from purpose and prompt content. */
  private makeCacheKey(req: AIRequest): string {
    if (req.cacheKey) return req.cacheKey;
    const hash = createHash('sha256')
      .update(`${req.purpose}:${req.prompt}`)
      .digest('hex')
      .slice(0, 16);
    return `${req.purpose}:${hash}`;
  }

  /**
   * Unified AI generation with cache-first, budget-aware, fallback-safe routing.
   *
   * Flow: Cache → Budget check → Gemini call → Fallback
   */
  async generate(req: AIRequest): Promise<AIResponse> {
    const ttl = req.cacheTtlMs ?? DEFAULT_TTL[req.purpose] ?? 0;
    const cacheKey = this.makeCacheKey(req);

    // 1. Check cache
    if (ttl > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached !== null) {
        logger.debug({ purpose: req.purpose, cacheKey }, 'AIGateway: Cache hit');
        tokenBudget.record({
          purpose: req.purpose,
          inputTokens: 0,
          outputTokens: 0,
          cached: true,
        });
        return {
          text: cached,
          cached: true,
          inputTokens: 0,
          outputTokens: 0,
          purpose: req.purpose,
        };
      }
    }

    // 2. Check budget
    if (!tokenBudget.shouldAllow(req.priority)) {
      logger.info({ purpose: req.purpose, priority: req.priority }, 'AIGateway: Budget blocked');
      return this.runFallback(req, 'budget_exceeded');
    }

    // 3. Check client availability
    if (!this.client) {
      return this.runFallback(req, 'no_client');
    }

    // 4. Call Gemini
    try {
      const config: Record<string, unknown> = {
        systemInstruction: req.systemInstruction,
        maxOutputTokens: req.maxOutputTokens,
      };
      if (req.responseSchema) {
        config.responseMimeType = req.responseMimeType || 'application/json';
        config.responseSchema = req.responseSchema;
      }
      if (req.temperature !== undefined) {
        config.temperature = req.temperature;
      }

      const targetModel =
        req.model || (req.purpose === 'coach' ? this.agentModelName : this.modelName);

      const response = await this.client.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
        config,
      });

      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      // Estimate token counts (rough: 1 token ≈ 4 chars)
      const inputTokens = Math.ceil(
        (req.prompt.length + req.systemInstruction.length) / 4,
      );
      const outputTokens = Math.ceil(text.length / 4);

      // Record usage
      tokenBudget.record({
        purpose: req.purpose,
        inputTokens,
        outputTokens,
        cached: false,
      });

      // Store in cache
      if (ttl > 0) {
        this.cache.set(cacheKey, text, ttl);
      }

      logger.debug(
        { purpose: req.purpose, inputTokens, outputTokens },
        'AIGateway: Gemini call succeeded',
      );

      return {
        text,
        cached: false,
        inputTokens,
        outputTokens,
        purpose: req.purpose,
      };
    } catch (err) {
      logger.warn(
        { err, purpose: req.purpose },
        'AIGateway: Gemini call failed — falling back',
      );
      return this.runFallback(req, 'api_error');
    }
  }

  private runFallback(
    req: AIRequest,
    reason: string,
  ): AIResponse {
    if (req.fallbackFn) {
      const text = req.fallbackFn();
      tokenBudget.record({
        purpose: req.purpose,
        inputTokens: 0,
        outputTokens: 0,
        cached: false,
      });
      logger.info({ purpose: req.purpose, reason }, 'AIGateway: Used local fallback');
      return {
        text,
        cached: false,
        inputTokens: 0,
        outputTokens: 0,
        purpose: req.purpose,
      };
    }
    throw new Error(
      `AIGateway: No fallback defined for purpose '${req.purpose}' (reason: ${reason})`,
    );
  }

  /** Expose cache stats for monitoring. */
  getCacheStats() {
    return { cacheSize: this.cache.size };
  }
}

/** Singleton AI Gateway instance. */
export const aiGateway = new AIGateway();
