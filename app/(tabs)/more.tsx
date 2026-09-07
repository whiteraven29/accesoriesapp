import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, PackageX, Receipt, ScanLine, Settings, Users, WalletCards } from 'lucide-react-native';
import { Screen, ScreenHeader } from '../../components/Screen';
import { Accent, Card, IconChip } from '../../components/ui';
import { Palette, fontSize, fontWeight, spacing } from '../../constants/theme';
import { useLanguage } from '../../hooks/LanguageContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useTheme } from '../../hooks/useTheme';
import { useMemo } from 'react';

/**
 * The tools that do not earn a slot on the tab bar.
 *
 * Previously this screen hardcoded every colour, its own 800px breakpoint and
 * its own type scale, so it stayed light-grey when the rest of the app went
 * dark. It now resolves everything from the shared tokens like every other
 * screen.
 */
export default function MoreScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const { isPhone } = useResponsive();
  const styles = useMemo(() => createStyles(c), [c]);

  const tools: { route: string; title: string; description: string; icon: typeof ScanLine; accent: Accent }[] = [
    { route: '/(tabs)/imei', title: t('imeiLookup'), description: t('searchByImei'), icon: ScanLine, accent: 'violet' },
    { route: '/(tabs)/receipts', title: t('receipts'), description: t('receiptsHistory'), icon: Receipt, accent: 'blue' },
    { route: '/(tabs)/customers', title: t('customers'), description: t('customerManagement'), icon: Users, accent: 'green' },
    { route: '/(tabs)/expenses', title: t('expenses'), description: t('expenseManagement'), icon: WalletCards, accent: 'pink' },
    { route: '/(tabs)/losses', title: t('recordLoss'), description: t('lossInformation'), icon: PackageX, accent: 'orange' },
    { route: '/(tabs)/settings', title: t('settings'), description: t('appearance'), icon: Settings, accent: 'yellow' },
  ];

  return (
    <Screen>
      <ScreenHeader title={t('more')} subtitle={t('businessTools')} />
      <View style={styles.grid}>
        {tools.map(({ route, title, description, icon: Icon, accent }) => (
          <Pressable
            key={route}
            onPress={() => router.push(route as never)}
            accessibilityRole="link"
            accessibilityLabel={title}
            accessibilityHint={description}
            style={({ pressed }) => [
              styles.cell,
              { flexBasis: isPhone ? '100%' : '47%', opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Card style={styles.card}>
              <IconChip accent={accent} size={52}>
                <Icon color={c.accent[accent]} size={22} />
              </IconChip>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
              </View>
              <ChevronRight color={c.textSubtle} size={18} />
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { flexGrow: 1 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  copy: { flex: 1 },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  description: { fontSize: fontSize.sm, color: c.textMuted, marginTop: 3 },
});
