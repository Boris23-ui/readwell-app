import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockGetUser, mockSupabaseConfigured } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSupabaseConfigured: { value: true },
}));

vi.mock('../lib/supabase', () => ({
  getSupabaseAdmin: () =>
    mockSupabaseConfigured.value
      ? { auth: { getUser: mockGetUser } }
      : null,
  isSupabaseConfigured: () => mockSupabaseConfigured.value,
}));

import { optionalAuth, requireAuth, type AuthenticatedRequest } from './auth';

const app = express();
app.use(express.json());

app.get('/optional/:userId', optionalAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.get('/required', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

describe('Auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseConfigured.value = true;
  });

  it('assigns an isolated guest:* identity when no Authorization header is present', async () => {
    const res = await request(app)
      .get('/optional/some-real-uuid-attempt')
      .set('x-readwell-guest-id', 'guest_device_123')
      .expect(200);

    expect(res.body.user).toEqual({
      id: 'guest:guest_device_123',
      isGuest: true,
    });
  });

  it('authenticates a valid Supabase Bearer token in optionalAuth', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'real-user-uuid', email: 'reader@example.com' } },
      error: null,
    });

    const res = await request(app)
      .get('/optional/ignored-param')
      .set('Authorization', 'Bearer valid-jwt')
      .expect(200);

    expect(res.body.user).toEqual({
      id: 'real-user-uuid',
      email: 'reader@example.com',
      isGuest: false,
    });
  });

  it('rejects an invalid Bearer token with 401 instead of downgrading to guest', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid token' },
    });

    await request(app)
      .get('/optional/guest_1')
      .set('Authorization', 'Bearer forged-token')
      .expect(401);
  });

  it('rejects unauthenticated requests on requireAuth', async () => {
    await request(app).get('/required').expect(401);
  });
});
