import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { LanguageProvider } from '@/hooks/LanguageContext';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </LanguageProvider>
  );
}
