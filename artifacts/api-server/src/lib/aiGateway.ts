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

export type AIPurpose = 'quiz' | 'simplify' | 'comprehension' | 'coach';

export type AIGatewayErrorReason = 'no_client' | 'budget_exceeded' | 'api_error';

export class AIGatewayError extends Error {
  readonly reason: AIGatewayErrorReason;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    message: string,
    reason: AIGatewayErrorReason,
    opts?: { status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = 'AIGatewayError';
    this.reason = reason;
    this.status = opts?.status;
    this.cause = opts?.cause;
  }
}

export interface AIRequest {
  purpose: AIPurpose;
  priority: AIPriority;
  /** Explicit cache key. If omitted, one is auto-generated from prompt + purpose. */
  cacheKey?: string;
  /** Cache TTL in ms. Defaults vary by purpose. Set to 0 to skip caching. */
  cacheTtlMs?: number;
  image?: {
    mimeType: string;
    data: string;
  };
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

  coach: 0,                        // never cache chat responses
};

const GEMINI_TIMEOUT_MS = 25_000;
const MODEL_COOLDOWN_MS = 5 * 60 * 1000;

export function isModelFailoverError(err: unknown): boolean {
  const errObj = err as { name?: unknown; message?: unknown; status?: unknown; statusCode?: unknown } | null;
  const errName = String(errObj?.name || '');
  const errMsg = String(errObj?.message || err || '');
  const status = Number(errObj?.status ?? errObj?.statusCode);

  if (status === 404 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  if (/AbortError|TimeoutError/i.test(errName)) {
    return true;
  }
  return (
    /429|quota|RESOURCE_EXHAUSTED|Too Many Requests/i.test(errMsg) ||
    /500|502|503|504|404|408/i.test(errMsg) ||
    /Service Unavailable|Gateway Timeout|Not Found|timeout|timed out|aborted/i.test(errMsg)
  );
}

class AIGateway {
  private client: GoogleGenAI | null = null;
  private modelName: string;
  private agentModelName: string;
  private cache = new LRUCache(200);
  private unhealthyModels = new Map<string, number>();
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
      if (req.responseMimeType) {
        config.responseMimeType = req.responseMimeType;
      }
      if (req.responseSchema) {
        config.responseMimeType = (config.responseMimeType as string) || 'application/json';
        config.responseSchema = req.responseSchema;
      }
      if (req.temperature !== undefined) {
        config.temperature = req.temperature;
      }

      const primaryModel =
        req.model || (req.purpose === 'coach' ? this.agentModelName : this.modelName);

      const allCandidates = Array.from(
        new Set([
          primaryModel,
          'gemini-3-flash-preview',
          'gemini-3.6-flash',
          'gemini-flash-latest',
        ]),
      );

      // Skip models that recently timed out or returned 503/404 so subsequent calls stay fast.
      const now = Date.now();
      const healthyCandidates = allCandidates.filter((m) => {
        const until = this.unhealthyModels.get(m);
        if (until === undefined) return true;
        if (now >= until) {
          this.unhealthyModels.delete(m);
          return true;
        }
        return false;
      });
      const candidateModels = healthyCandidates.length > 0 ? healthyCandidates : allCandidates;

      const parts: any[] = [{ text: req.prompt }];
      if (req.image) {
        parts.push({
          inlineData: {
            mimeType: req.image.mimeType,
            data: req.image.data,
          },
        });
      }

      let text = '';
      let lastError: unknown = null;

      for (const currentModel of candidateModels) {
        try {
          const response = await this.client.models.generateContent({
            model: currentModel,
            contents: [{ role: 'user', parts }],
            config,
          });
          const candidateText = (response.text ?? '').trim();
          if (candidateText) {
            text = candidateText;
            this.unhealthyModels.delete(currentModel);
            if (currentModel !== primaryModel) {
              logger.info(
                { primaryModel, fallbackModel: currentModel, purpose: req.purpose },
                'AIGateway: Successfully generated using fallback model',
              );
            }
            break;
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || '');
          if (isModelFailoverError(err)) {
            this.unhealthyModels.set(currentModel, Date.now() + MODEL_COOLDOWN_MS);
            logger.warn(
              { failedModel: currentModel, error: errMsg.slice(0, 120), purpose: req.purpose },
              'AIGateway: Model unavailable or timed out, trying next candidate model...',
            );
            continue;
          }
          throw err;
        }
      }

      if (!text) {
        throw lastError || new Error('Empty response from all candidate models');
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
      return this.runFallback(req, 'api_error', err);
    }
  }

  private runFallback(
    req: AIRequest,
    reason: AIGatewayErrorReason,
    cause?: unknown,
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

    let status: number | undefined;
    if (typeof cause === 'object' && cause !== null) {
      const rec = cause as Record<string, unknown>;
      for (const k of ['status', 'statusCode', 'code'] as const) {
        const val = Number(rec[k]);
        if (Number.isInteger(val) && val >= 400 && val <= 599) {
          status = val;
          break;
        }
      }
    }
    if (!status && cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      const match = msg.match(/\b(401|403|404|408|429|500|502|503|504)\b/);
      if (match) status = Number(match[1]);
    }

    throw new AIGatewayError(
      `AIGateway: No fallback defined for purpose '${req.purpose}' (reason: ${reason})`,
      reason,
      { status, cause },
    );
  }

  /** Expose cache stats for monitoring. */
  getCacheStats() {
    return { cacheSize: this.cache.size };
  }
}

/** Singleton AI Gateway instance. */
export const aiGateway = new AIGateway();
