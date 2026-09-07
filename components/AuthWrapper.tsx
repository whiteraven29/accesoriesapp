import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { APP_NAME } from '../constants/app';
import { fontSize, fontWeight, spacing } from '../constants/theme';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { isSupabaseConfigured } from '../utils/supabase';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const inAuthGroup = segments[0] === 'auth';

  useEffect(() => {
    if (loading) return;

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, loading, inAuthGroup, router]);

  if (!isSupabaseConfigured) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: spacing.xxl }]}>
        <Text style={[styles.title, { color: colors.text }]}>{APP_NAME} configuration required</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the deployment
          environment variables, then deploy again.
        </Text>
      </View>
    );
  }

  // Holding the spinner through the redirect prevents a flash of the protected
  // UI between the auth state resolving and the navigator moving.
  const redirecting = (!user && !inAuthGroup) || Boolean(user && inAuthGroup);

  if (loading || redirecting) {
    return (
      <View
        style={[styles.center, { backgroundColor: colors.background }]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading"
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: { fontSize: fontSize.md, lineHeight: 24, textAlign: 'center', maxWidth: 620 },
});
