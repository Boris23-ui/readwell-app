import { describe, it, expect } from 'vitest';
import { aiGateway, isModelFailoverError } from './aiGateway';

describe('AIGateway', () => {
  it('should be defined', () => {
    expect(aiGateway).toBeDefined();
  });

  it('should maintain cache stats correctly', () => {
    const stats = aiGateway.getCacheStats();
    expect(stats).toHaveProperty('cacheSize');
  });

  it('treats timeouts, gateway errors, 404s, and rate limits as failover-eligible', () => {
    const abortErr = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    expect(isModelFailoverError(abortErr)).toBe(true);
    expect(isModelFailoverError(new Error('Retryable HTTP Error: Gateway Timeout'))).toBe(true);
    expect(isModelFailoverError(new Error('Retryable HTTP Error: Service Unavailable'))).toBe(true);
    expect(isModelFailoverError(new Error('Non-retryable exception Not Found sending request'))).toBe(true);
    expect(isModelFailoverError({ status: 429, message: 'Too Many Requests' })).toBe(true);
    expect(isModelFailoverError({ status: 401, message: 'Invalid API key' })).toBe(false);
  });
});
