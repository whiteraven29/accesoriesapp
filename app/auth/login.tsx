import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { Palette, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { getAuthRedirectUrl } from '../../utils/authRedirect';
import { authErrorKey, authErrorMessage } from '../../utils/authErrors';

export default function LoginScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailNeedsConfirmation, setEmailNeedsConfirmation] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    setLoading(true);
    setEmailNeedsConfirmation(false);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: username.trim().toLowerCase(),
        password,
      });

      if (error) {
        // Keyed off the stable error code rather than English prose, which
        // Supabase is free to reword.
        const needsConfirmation = authErrorKey(error) === 'emailNotConfirmed';
        setEmailNeedsConfirmation(needsConfirmation);
        Alert.alert(t('error'), authErrorMessage(error, t));
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      Alert.alert(t('error'), t('unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    const email = username.trim().toLowerCase();
    if (!email) {
      Alert.alert(t('error'), t('enterEmailFirst'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    setLoading(false);

    // Resending shares the project's hourly email quota with signup and password
    // reset, so a rate-limit reply here is expected and must read as guidance.
    Alert.alert(
      error ? t('error') : t('success'),
      error ? authErrorMessage(error, t) : t('verificationSent'),
    );
  };

  const styles = useMemo(() => createStyles(width, c), [width, c]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.textInput}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={c.textSubtle}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
              placeholderTextColor={c.textSubtle}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={18}
                color={c.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        {emailNeedsConfirmation && (
          <TouchableOpacity style={styles.linkButton} onPress={resendConfirmation} disabled={loading}>
            <Text style={styles.linkTextBold}>Resend verification email</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.replace('/auth/forgot-password')}
        >
          <Text style={styles.linkText}>
            Forgot Password? <Text style={styles.linkTextBold}>Reset</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.replace('/auth/signup')}
        >
          <Text style={styles.linkText}>
            Don&apos;t have an account? <Text style={styles.linkTextBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (viewportWidth: number, c: Palette) => {
  const width = Math.min(Math.max(viewportWidth, 320), 480);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
    padding: width * 0.05,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: width * 0.1,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.02,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: c.textMuted,
  },
  form: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: width * 0.05,
  },
  inputLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.textMuted,
    marginBottom: width * 0.02,
  },
  textInput: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    padding: width * 0.04,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.surface,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    backgroundColor: c.surface,
  },
  passwordInput: {
    flex: 1,
    padding: width * 0.04,
    fontSize: fontSize.md,
    color: c.text,
  },
  eyeIcon: {
    padding: width * 0.03,
  },
  button: {
    backgroundColor: c.primary,
    paddingVertical: width * 0.04,
    borderRadius: width * 0.025,
    alignItems: 'center',
    marginTop: width * 0.05,
  },
  buttonDisabled: {
    backgroundColor: c.textSubtle,
  },
  buttonText: {
    color: c.textInverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: width * 0.05,
  },
  linkText: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  linkTextBold: {
    color: c.primary,
    fontWeight: '600',
  },
  });
};
