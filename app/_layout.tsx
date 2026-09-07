import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthWrapper } from '../components/AuthWrapper';
import { LanguageProvider } from '../hooks/LanguageContext';
import { AuthProvider } from '../hooks/useAuth';
import { useAuthDeepLink } from '../hooks/useAuthDeepLink';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { ThemeProvider, useTheme } from '../hooks/useTheme';

/**
 * Split out so the status bar and navigator can read the resolved colour
 * scheme; providers cannot consume their own context.
 */
function AppShell() {
  const { scheme, colors } = useTheme();
  // Inside the navigator, so a recovery link can route to the password form.
  useAuthDeepLink();

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/forgot-password" />
        <Stack.Screen name="auth/update-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      {/* Follows the resolved theme rather than the device, so an in-app
          override still gets readable status bar icons. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} backgroundColor={colors.surface} />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <LanguageProvider>
              <AuthWrapper>
                <AppShell />
              </AuthWrapper>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
