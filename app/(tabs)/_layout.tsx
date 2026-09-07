import { Tabs } from 'expo-router';
import { Chrome as Home, Menu, Package, ChartBar as BarChart3 } from 'lucide-react-native';
import { HeaderActions } from '../../components/HeaderActions';
import { TabBar } from '../../components/TabBar';
import { APP_NAME } from '../../constants/app';
import { fontSize, fontWeight } from '../../constants/theme';
import { useLanguage } from '../../hooks/LanguageContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useTheme } from '../../hooks/useTheme';

/**
 * Native (iOS/Android) tab bar.
 *
 * `_layout.web.tsx` shadows this file on web, so nothing here needs to branch on
 * Platform.OS — the previous version carried roughly forty lines of web-only
 * sizing that could never execute.
 *
 * Four destinations flank a raised centre button. Selling is the one thing the
 * app exists to do and the one thing done while a customer waits, so the POS
 * takes the centre rather than sitting fourth along a row.
 */
export default function TabLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { isPhone } = useResponsive();

  const items = [
    { name: 'index', label: t('home'), Icon: Home },
    { name: 'products', label: t('inventory'), Icon: Package },
    { name: 'reports', label: t('reports'), Icon: BarChart3 },
    { name: 'more', label: t('more'), Icon: Menu },
  ];

  return (
    <Tabs
      tabBar={props => <TabBar {...props} items={items} centre={{ name: 'sales', label: t('pos') }} />}
      screenOptions={{
        headerShown: true,
        headerTitle: APP_NAME,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontWeight: fontWeight.bold,
          fontSize: fontSize.xl,
          color: colors.text,
        },
        // Flat and borderless so the page's wash is not cut off by a hard rule.
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerRight: () => <HeaderActions compact={isPhone} />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home') }} />
      <Tabs.Screen name="sales" options={{ title: t('pos') }} />
      <Tabs.Screen name="products" options={{ title: t('inventory') }} />
      <Tabs.Screen name="reports" options={{ title: t('reports') }} />
      <Tabs.Screen name="more" options={{ title: t('more') }} />

      {/* Reachable from the More screen and by URL, but not on the bar. */}
      <Tabs.Screen name="receipts" options={{ href: null, title: t('receipts') }} />
      <Tabs.Screen name="customers" options={{ href: null, title: t('customers') }} />
      <Tabs.Screen name="expenses" options={{ href: null, title: t('expenses') }} />
      <Tabs.Screen name="imei" options={{ href: null, title: t('imeiLookup') }} />
      <Tabs.Screen name="losses" options={{ href: null, title: t('recordLoss') }} />
      <Tabs.Screen name="settings" options={{ href: null, title: t('settings') }} />
    </Tabs>
  );
}
