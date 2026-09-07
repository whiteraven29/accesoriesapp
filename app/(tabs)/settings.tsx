import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Info, LogOut, Moon, Store } from 'lucide-react-native';
import { Button, Card, DetailRow, SegmentedControl } from '../../components/ui';
import { Screen, ScreenHeader } from '../../components/Screen';
import { APP_NAME } from '../../constants/app';
import { fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../hooks/LanguageContext';
import { useTheme } from '../../hooks/useTheme';
import { supabase } from '../../utils/supabase';

/**
 * Shop preferences. Appearance and language were previously buried in header
 * icons with no persistent home, and the loyalty rate had no UI at all.
 */
export default function SettingsScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { colors, preference, setPreference } = useTheme();
  const { signOut, user } = useAuth();

  const [shopName, setShopName] = useState('');
  const [loyaltyRate, setLoyaltyRate] = useState('1');
  const [saving, setSaving] = useState(false);

  const styles = useMemo(() => createStyles(), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('shop_name, loyalty_points_per_1000')
        .eq('id', user?.id ?? '')
        .single();

      if (active && data) {
        setShopName(data.shop_name ?? '');
        setLoyaltyRate(String(data.loyalty_points_per_1000 ?? 1));
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const saveProfile = async () => {
    const rate = Number(loyaltyRate);
    if (!Number.isInteger(rate) || rate < 0) {
      Alert.alert(t('error'), t('loyaltyPoints'));
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({ shop_name: shopName.trim(), loyalty_points_per_1000: rate })
      .eq('id', user?.id ?? '');
    setSaving(false);

    Alert.alert(error ? t('error') : t('success'), error ? error.message : t('synced'));
  };

  const confirmSignOut = () => {
    Alert.alert(t('signIn'), t('confirmDelete'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('ok'), style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <Screen measure="narrow" scroll>
      <ScreenHeader title={t('settings')} subtitle={APP_NAME} />

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Store size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('shopName')}</Text>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>{t('shopName')}</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          value={shopName}
          onChangeText={setShopName}
          placeholder={t('shopName')}
          placeholderTextColor={colors.textSubtle}
          accessibilityLabel={t('shopName')}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>
          {t('loyaltyPoints')} / 1,000 TZS
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          value={loyaltyRate}
          onChangeText={text => setLoyaltyRate(text.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          accessibilityLabel={t('loyaltyPoints')}
        />

        <Button label={t('save')} onPress={saveProfile} loading={saving} fullWidth />
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Moon size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('appearance')}</Text>
        </View>
        <SegmentedControl
          accessibilityLabel={t('appearance')}
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: t('systemMode') },
            { value: 'light', label: t('lightMode') },
            { value: 'dark', label: t('darkMode') },
          ]}
        />

        <Text style={[styles.label, { color: colors.textMuted, marginTop: spacing.lg }]}>
          {t('language')}
        </Text>
        <SegmentedControl
          accessibilityLabel={t('language')}
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'sw', label: 'Kiswahili' },
            { value: 'en', label: 'English' },
          ]}
        />
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Info size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{APP_NAME}</Text>
        </View>
        <DetailRow label={t('email')} value={user?.email ?? '—'} />
        <DetailRow label="Version" value="1.1.0" />
      </Card>

      <Button
        label={t('signIn')}
        onPress={confirmSignOut}
        tone="danger"
        variant="soft"
        icon={<LogOut size={18} color={colors.danger} />}
        fullWidth
        style={styles.signOut}
      />
    </Screen>
  );
}

const createStyles = () =>
  StyleSheet.create({
    card: { gap: spacing.md, marginBottom: spacing.lg },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
    label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
    input: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      minHeight: 46,
      fontSize: fontSize.md,
    },
    signOut: { marginTop: spacing.sm, marginBottom: spacing.xxl },
  });
