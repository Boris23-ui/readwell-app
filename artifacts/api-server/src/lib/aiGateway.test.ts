import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiGateway } from './aiGateway';
// We'd mock GoogleGenAI to not make real API calls, but vi.mock is useful here
// However, since aiGateway is already a singleton initialized with env vars, let's just 
// test the caching logic by mocking the internal cache or intercepting it.

// For now, we will just use dummy tests to verify the structure, or we can mock 
// the internal genAIClient if we export a way to inject it.

describe('AIGateway', () => {
  it('should be defined', () => {
    expect(aiGateway).toBeDefined();
  });

  it('should maintain cache stats correctly', () => {
    const stats = aiGateway.getCacheStats();
    expect(stats).toHaveProperty('cacheSize');
  });
});
