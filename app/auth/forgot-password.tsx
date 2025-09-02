import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { useLanguage } from '../../hooks/LanguageContext';

export default function ForgotPasswordScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!username) {
      Alert.alert(t('error'), 'Please enter your username');
      return;
    }

    setLoading(true);
    try {
      // First, get the user's email from their username
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('username', username)
        .single();

      if (profileError || !profile) {
        Alert.alert(t('error'), 'Username not found');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: 'your-app-scheme://reset-password',
      });

      if (error) {
        Alert.alert(t('error'), error.message);
      } else {
        Alert.alert('Success', 'Password reset email sent! Please check your email.');
        router.replace('/auth/login');
      }
    } catch (error) {
      Alert.alert(t('error'), 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(width);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your username to reset your password</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.textInput}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            autoCapitalize="none"
            placeholderTextColor="#9CA3AF"
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

const createStyles = (width: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: width * 0.05,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: width * 0.1,
  },
  title: {
    fontSize: width * 0.08,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.02,
  },
  subtitle: {
    fontSize: width * 0.04,
    color: '#6B7280',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: width * 0.05,
  },
  inputLabel: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#374151',
    marginBottom: width * 0.02,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: width * 0.025,
    padding: width * 0.04,
    fontSize: width * 0.04,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: width * 0.04,
    borderRadius: width * 0.025,
    alignItems: 'center',
    marginTop: width * 0.05,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: width * 0.04,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: width * 0.05,
  },
  linkText: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  linkTextBold: {
    color: '#2563EB',
    fontWeight: '600',
  },
});