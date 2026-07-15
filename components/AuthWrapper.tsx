import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

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
});
