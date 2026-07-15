import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../utils/supabase';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === 'auth';

  useEffect(() => {
    if (loading) return;

    if (!user && !inAuthGroup) {
      // User is not authenticated and not on auth screen, redirect to login
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // User is authenticated and on auth screen, redirect to main app
      router.replace('/(tabs)');
    }
  }, [user, loading, inAuthGroup, router]);

  if (!isSupabaseConfigured) {
    return (
      <View style={styles.configurationContainer}>
        <Text style={styles.configurationTitle}>DukaSmart configuration required</Text>
        <Text style={styles.configurationText}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the Netlify environment variables, then deploy again.
        </Text>
      </View>
    );
  }

  const redirecting = (!user && !inAuthGroup) || Boolean(user && inAuthGroup);

  if (loading || redirecting) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  configurationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: '#F8FAFC',
  },
  configurationTitle: {
    color: '#172033',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  configurationText: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 620,
  },
});
