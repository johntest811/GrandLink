import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra =
  (Constants.expoConfig?.extra as Record<string, any> | undefined) ||
  ((Constants as any).manifest2?.extra as Record<string, any> | undefined) ||
  ((Constants as any).manifest?.extra as Record<string, any> | undefined);

const SUPABASE_URL =
  extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_ANON_KEY =
  extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

const hasValidConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!hasValidConfig) {
  console.warn('Supabase config missing at runtime. App will stay open but backend features may fail until env is fixed.');
}

const FALLBACK_URL = 'https://example.com';
const FALLBACK_KEY = 'public-anon-key-placeholder';

export const supabase = createClient(
  hasValidConfig ? SUPABASE_URL : FALLBACK_URL,
  hasValidConfig ? SUPABASE_ANON_KEY : FALLBACK_KEY
);