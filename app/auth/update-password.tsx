import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Palette } from '../../constants/theme';
import { useLanguage } from '../../hooks/LanguageContext';
import { useTheme } from '../../hooks/useTheme';
import { MIN_PASSWORD_LENGTH, authErrorMessage } from '../../utils/authErrors';
import { supabase } from '../../utils/supabase';

export default function UpdatePasswordScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Reaching this screen without a session means the recovery link expired, was
  // already used, or was opened in a different browser. Say so plainly instead
  // of letting the save fail later with "Auth session missing".
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasSession(Boolean(session));
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const updatePassword = async () => {
    if (hasSession === false) {
      Alert.alert(t('error'), t('resetLinkExpired'));
      router.replace('/auth/forgot-password');
      return;
    }
    // Same floor as signup: requiring more here would lock out anyone who
    // registered with a shorter password.
    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(t('error'), t('passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('error'), t('passwordsDoNotMatch'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert(t('error'), authErrorMessage(error, t));
      return;
    }
    Alert.alert(t('success'), t('passwordUpdated'));
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a new password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry />
      <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry />
      <TouchableOpacity style={styles.button} onPress={updatePassword} disabled={loading}>
        {loading ? <ActivityIndicator color={c.textInverse} /> : <Text style={styles.buttonText}>Update password</Text>}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.background, gap: 16, width: '100%', maxWidth: 520, alignSelf: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: c.text, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: 10, padding: 14, backgroundColor: c.surface },
  button: { backgroundColor: c.primary, borderRadius: 10, padding: 15, alignItems: 'center' },
  buttonText: { color: c.textInverse, fontWeight: '600' },
});
