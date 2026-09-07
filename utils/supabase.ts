import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import { supabaseStorage } from './storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Keep the UI renderable when deployment variables are missing. AuthWrapper
// shows an actionable configuration screen instead of leaving a blank page.
export const supabase = createClient(
  supabaseUrl || 'https://configuration-required.supabase.co',
  supabaseAnonKey || 'configuration-required',
  {
    auth: {
      // Without an explicit adapter supabase-js falls back to in-memory storage
      // on native, which signed the shopkeeper out on every cold start of the
      // Android build. Web keeps its default localStorage.
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Only the web build can read a session back out of the URL fragment
      // after a password-reset or magic-link redirect.
      detectSessionInUrl: Platform.OS === 'web',
    },
    realtime: {
      // Market connections are slow and metered. Throttling the socket keeps
      // background sync from competing with the till for bandwidth.
      params: { eventsPerSecond: 3 },
    },
  },
);
