// Import URL polyfill for React Native
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase environment variables:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY });
}

console.log('MOBILE APP - Supabase configured WITHOUT web redirects');

// Configure auth for React Native (Expo) with PKCE and persistent storage
// This ensures sessions persist across app launches and avoids web redirects
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'implicit',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Critical: Disable URL detection in mobile
    storage: AsyncStorage,
    storageKey: 'grandlink-mobile-auth',
    // Disable crypto for React Native compatibility
    debug: __DEV__,
  },
});

// For backward compatibility across imports that expect default
export default supabase;