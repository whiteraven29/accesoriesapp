import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * One storage surface for both platforms.
 *
 * AsyncStorage works on web too, but it proxies to localStorage, which throws
 * in private-mode browsers. Every call is guarded so a storage failure degrades
 * to "no saved preference" instead of crashing the shop's till.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Preference is lost for this session only; not worth surfacing.
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // As above.
    }
  },
};

/**
 * Storage adapter handed to supabase-js.
 *
 * Without this the client falls back to in-memory storage on native, so the
 * Android build logged the shopkeeper out on every cold start. On web we keep
 * localStorage, which survives a reload.
 */
export const supabaseStorage =
  Platform.OS === 'web'
    ? undefined // supabase-js uses localStorage by default on web.
    : {
        getItem: (key: string) => AsyncStorage.getItem(key),
        setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
        removeItem: (key: string) => AsyncStorage.removeItem(key),
      };

export const STORAGE_KEYS = {
  language: 'dukasmart.language',
  colorScheme: 'dukasmart.colorScheme',
  offlineQueue: 'dukasmart.offlineQueue',
  sidebarCollapsed: 'dukasmart.sidebarCollapsed',
} as const;
