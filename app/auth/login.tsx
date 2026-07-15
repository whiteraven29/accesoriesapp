import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { useLanguage } from '../../hooks/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert(t('error'), 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: username.trim().toLowerCase(),
        password,
      });

      if (error) {
        Alert.alert(t('error'), error.message);
      } else {
        router.replace('/(tabs)');
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
            placeholderTextColor="#9CA3AF"
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
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#6B7280"
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

const createStyles = (viewportWidth: number) => {
  const width = Math.min(Math.max(viewportWidth, 320), 480);
  return StyleSheet.create({
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
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: width * 0.025,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    padding: width * 0.04,
    fontSize: width * 0.04,
    color: '#111827',
  },
  eyeIcon: {
    padding: width * 0.03,
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
};
