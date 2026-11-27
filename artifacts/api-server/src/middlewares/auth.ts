import { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    isGuest?: boolean;
  };
}

function sanitizeGuestId(raw: unknown): string {
  if (typeof raw !== 'string') return 'guest:session';
  const cleaned = raw
    .trim()
    .replace(/^guest:/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  return cleaned ? `guest:${cleaned}` : 'guest:session';
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    logger.error('Supabase not configured for auth');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      isGuest: false,
    };

    next();
  } catch (err) {
    logger.error({ err }, 'Auth middleware error');
    res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Authenticates signed-in Supabase users when a Bearer token is supplied,
 * and falls back to an isolated ephemeral `guest:*` identity when no
 * Authorization header is present (guest / offline-demo sessions).
 *
 * Explicit Bearer tokens that fail verification are still rejected with 401
 * so invalid or forged credentials are never silently downgraded.
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Server running without Supabase configured — allow isolated guest session
      req.user = {
        id: sanitizeGuestId(req.headers['x-readwell-guest-id'] ?? req.params?.userId),
        isGuest: true,
      };
      next();
      return;
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      req.user = {
        id: user.id,
        email: user.email,
        isGuest: false,
      };
      next();
      return;
    } catch (err) {
      logger.error({ err }, 'Optional auth verification error');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const rawGuest =
    req.headers['x-readwell-guest-id'] ??
    (req.params as Record<string, unknown> | undefined)?.userId ??
    (req.body as Record<string, unknown> | undefined)?.userId;

  req.user = {
    id: sanitizeGuestId(rawGuest),
    isGuest: true,
  };
  next();
};
