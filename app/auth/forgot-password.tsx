import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { Palette, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { getAuthRedirectUrl } from '../../utils/authRedirect';
import { authErrorMessage } from '../../utils/authErrors';

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!username) {
      Alert.alert(t('error'), t('enterEmailFirst'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(username.trim().toLowerCase(), {
        redirectTo: getAuthRedirectUrl('auth/update-password'),
      });

      if (error) {
        // Password reset draws on the same hourly email quota as signup.
        Alert.alert(t('error'), authErrorMessage(error, t));
      } else {
        Alert.alert(t('success'), t('verificationSent'));
        router.replace('/auth/login');
      }
    } catch (error) {
      Alert.alert(t('error'), t('unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => createStyles(width, c), [width, c]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email to reset your password</Text>
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

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Sending...' : 'Send Reset Email'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.replace('/auth/login')}
        >
          <Text style={styles.linkText}>
            Remember your password? <Text style={styles.linkTextBold}>Sign In</Text>
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
    textAlign: 'center',
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
