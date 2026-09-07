import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '../utils/supabase';

/**
 * Establishes a session from an auth link opened on native.
 *
 * On web, supabase-js does this itself via `detectSessionInUrl`. On native that
 * option is off (there is no `window.location`) and nothing replaced it, so a
 * password-reset link opened the app at `update-password` with no session and
 * `updateUser` failed with "Auth session missing" — password reset could not be
 * completed on the Android build at all.
 *
 * Handles both flows, because the shape depends on the client's `flowType`:
 *   implicit -> #access_token=...&refresh_token=...
 *   pkce     -> ?code=...
 */
export function useAuthDeepLink() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;

    const handleUrl = async (url: string | null) => {
      if (!url || !active) return;

      const { queryParams } = Linking.parse(url);
      // `Linking.parse` leaves the fragment alone, and implicit-flow tokens
      // arrive there rather than in the query string.
      const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
      const fragmentParams = new URLSearchParams(fragment);

      const param = (key: string): string | undefined =>
        (queryParams?.[key] as string | undefined) ?? fragmentParams.get(key) ?? undefined;

      const errorDescription = param('error_description');
      if (errorDescription) {
        console.error('Auth link rejected:', errorDescription);
        return;
      }

      const accessToken = param('access_token');
      const refreshToken = param('refresh_token');
      const code = param('code');

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          return; // An ordinary deep link, not an auth callback.
        }
      } catch (error) {
        console.error('Could not establish session from link:', error);
        return;
      }

      if (!active) return;

      // A recovery link must land on the password form; anything else can fall
      // through to the app, which AuthWrapper will route now a session exists.
      if (param('type') === 'recovery' || url.includes('update-password')) {
        router.replace('/auth/update-password');
      }
    };

    // Cold start: the link that launched the app.
    Linking.getInitialURL().then(handleUrl);

    // Warm start: the app was already running.
    const subscription = Linking.addEventListener('url', event => handleUrl(event.url));

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);
}
