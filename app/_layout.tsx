import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { LanguageProvider } from '@/hooks/LanguageContext';
import { AuthProvider } from '@/hooks/useAuth';
import { AuthWrapper } from '@/components/AuthWrapper';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <LanguageProvider>
        <AuthWrapper>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/signup" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="+not-found" />
          </Stack>
        </AuthWrapper>
        <StatusBar style="auto" />
      </LanguageProvider>
    </AuthProvider>
  );
}
