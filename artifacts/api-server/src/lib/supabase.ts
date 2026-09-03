import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

let _adminClient: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder'));
};

export const getSupabaseAdmin = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!_adminClient) {
    try {
      _adminClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      logger.info('Supabase Admin client initialized successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize Supabase Admin client');
      return null;
    }
  }
  return _adminClient;
};
