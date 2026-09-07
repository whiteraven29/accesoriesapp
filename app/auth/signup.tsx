import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { Palette, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { getAuthRedirectUrl } from '../../utils/authRedirect';
import { MIN_PASSWORD_LENGTH, authErrorMessage } from '../../utils/authErrors';

export default function SignupScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignup = async () => {
    if (!username || !email || !password || !confirmPassword || !shopName) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('passwordsDoNotMatch'));
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(t('error'), t('passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      // Check the username before creating the account. `user_profiles.username`
      // is UNIQUE and the signup trigger writes it, so a clash otherwise aborts
      // the whole signup with a raw constraint error. RLS hides the table from
      // anonymous visitors, so this goes through a SECURITY DEFINER function
      // that answers availability and nothing else.
      const { data: available, error: checkError } = await supabase.rpc('username_available', {
        p_username: username.trim(),
      });

      if (!checkError && available === false) {
        Alert.alert(t('error'), t('usernameTaken'));
        return;
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
          data: {
            username: username.trim(),
            full_name: fullName.trim(),
            phone: phone.trim(),
            shop_name: shopName.trim(),
          }
        }
      });

      if (signUpError) {
        Alert.alert(t('error'), authErrorMessage(signUpError, t));
        return;
      }

      if (authData.user) {
        // The database trigger creates the profile even when email confirmation
        // means the new user does not have an authenticated session yet.
        Alert.alert(t('success'), t('signupSuccess'));
        router.replace('/auth/login');
      }
    } catch (error) {
      Alert.alert(t('error'), t('unexpectedError'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => createStyles(width, c), [width, c]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username *</Text>
            <TextInput
              style={styles.textInput}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              autoCapitalize="none"
              placeholderTextColor={c.textSubtle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              autoCapitalize="words"
              placeholderTextColor={c.textSubtle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={c.textSubtle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput
              style={styles.textInput}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              placeholderTextColor={c.textSubtle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Shop Name *</Text>
            <TextInput
              style={styles.textInput}
              value={shopName}
              onChangeText={setShopName}
              placeholder="Enter your shop name"
              autoCapitalize="words"
              placeholderTextColor={c.textSubtle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password *</Text>
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

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Confirm Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your password"
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor={c.textSubtle}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={18}
                  color={c.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={c.textInverse} />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.replace('/auth/login')}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (viewportWidth: number, c: Palette) => {
  const width = Math.min(Math.max(viewportWidth, 320), 480);
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    flex: 1,
    padding: width * 0.05,
    justifyContent: 'center',
    paddingTop: width * 0.1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: width * 0.08,
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
    flexDirection: 'row',
    justifyContent: 'center',
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
