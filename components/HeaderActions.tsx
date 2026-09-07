import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Languages, Moon, Sun, WifiOff } from 'lucide-react-native';
import { HIT_SLOP, MIN_TOUCH_TARGET, fontSize, fontWeight, radius, spacing } from '../constants/theme';
import { useLanguage } from '../hooks/LanguageContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useTheme } from '../hooks/useTheme';

/**
 * Right-hand header cluster: connectivity, language and appearance.
 *
 * Shared by both tab layouts so the two platforms cannot drift apart, which is
 * how the app ended up showing three different names for itself.
 */
export function HeaderActions({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const { toggleLanguage, language, t } = useLanguage();
  const { scheme, toggleScheme } = useTheme();
  const { isOnline } = useNetworkStatus();

  const size = compact ? 18 : 20;

  return (
    <View style={[styles.row, { marginRight: compact ? spacing.md : spacing.lg }]}>
      {!isOnline ? (
        <View
          style={[styles.offline, { backgroundColor: colors.warningTint }]}
          accessibilityRole="alert"
          accessibilityLabel={t('offline')}
        >
          <WifiOff size={14} color={colors.warning} />
          {!compact ? (
            <Text style={{ color: colors.warning, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>
              {t('offline')}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={toggleScheme}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t('appearance')}
        accessibilityHint={scheme === 'dark' ? t('lightMode') : t('darkMode')}
        style={({ pressed }) => [
          styles.iconButton,
          { backgroundColor: colors.surfaceSunken, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        {scheme === 'dark' ? (
          <Sun size={size} color={colors.text} />
        ) : (
          <Moon size={size} color={colors.text} />
        )}
      </Pressable>

      <Pressable
        onPress={toggleLanguage}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={t('language')}
        // Announce the language being switched to, not the current one.
        accessibilityHint={language === 'sw' ? 'English' : 'Kiswahili'}
        style={({ pressed }) => [
          styles.iconButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Languages size={size} color={colors.textInverse} />
        <Text style={{ color: colors.textInverse, fontSize: fontSize.xs, fontWeight: fontWeight.bold }}>
          {language === 'sw' ? 'SW' : 'EN'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    minWidth: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET - 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
});
