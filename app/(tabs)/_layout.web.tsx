import { Tabs } from 'expo-router';
import {
  ChartBar as BarChart3,
  Chrome as Home,
  Menu,
  Package,
  PackageX,
  Receipt,
  ScanLine,
  Settings,
  ShoppingCart,
  Users,
  WalletCards,
} from 'lucide-react-native';
import { HeaderActions } from '../../components/HeaderActions';
import { WebSidebar } from '../../components/WebSidebar';
import { APP_NAME } from '../../constants/app';
import { SIDEBAR_WIDTH } from '../../constants/layout';
import { fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useLanguage } from '../../hooks/LanguageContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useTheme } from '../../hooks/useTheme';

/**
 * Web tab bar. Shadows `_layout.tsx` on web via the platform extension.
 *
 * Desktop promotes every destination into a persistent left rail — a 260px
 * sidebar has room for all eight, so hiding three behind "More" was a phone
 * pattern applied where it cost the user a click for no reason. Below the
 * desktop breakpoint the rail collapses to the same five-tab bottom bar the
 * native app uses.
 */
export default function WebTabLayout() {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const { isDesktop, width } = useResponsive();

  const primary = [
    { name: 'index', label: t('home'), Icon: Home },
    { name: 'sales', label: isDesktop ? t('pointOfSale') : t('pos'), Icon: ShoppingCart },
    { name: 'products', label: t('inventory'), Icon: Package },
    { name: 'reports', label: isDesktop ? t('reports') : t('reportsShort'), Icon: BarChart3 },
  ];

  // Promoted onto the rail on desktop, folded into "More" on narrow web.
  const secondary = [
    { name: 'receipts', label: t('receipts'), Icon: Receipt },
    { name: 'customers', label: t('customers'), Icon: Users },
    { name: 'expenses', label: t('expenses'), Icon: WalletCards },
    { name: 'imei', label: t('imeiLookup'), Icon: ScanLine },
    { name: 'losses', label: t('recordLoss'), Icon: PackageX },
    { name: 'settings', label: t('settings'), Icon: Settings },
  ];

  const visible = isDesktop ? [...primary, ...secondary] : primary;
  const hidden = isDesktop ? [] : secondary;

  return (
    <Tabs
      // Desktop gets the custom rail: scrollable and collapsible, so no
      // destination can be cut off on a short window. Narrow web keeps the
      // stock bottom bar.
      tabBar={isDesktop ? props => <WebSidebar {...props} /> : undefined}
      screenOptions={{
        headerShown: true,
        headerTitle: isDesktop ? '' : APP_NAME,
        headerTitleStyle: {
          fontWeight: fontWeight.bold,
          fontSize: fontSize.xl,
          color: colors.text,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerRight: () => <HeaderActions />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarVariant: isDesktop ? 'material' : 'uikit',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: isDesktop
          ? {
              width: SIDEBAR_WIDTH,
              paddingTop: spacing.lg,
              paddingHorizontal: spacing.sm,
              backgroundColor: colors.surface,
              borderRightWidth: 1,
              borderRightColor: colors.border,
            }
          : {
              // Tall enough that a single-line label is never clipped.
              minHeight: 64,
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            },
        tabBarItemStyle: isDesktop
          ? { minHeight: 52, marginBottom: spacing.xs, borderRadius: radius.md }
          : undefined,
        tabBarLabelStyle: {
          fontSize: isDesktop ? fontSize.md : fontSize.xs,
          fontWeight: fontWeight.semibold,
        },
        // Narrow web keeps labels: five items still fit above 360px.
        tabBarShowLabel: isDesktop || width >= 360,
      }}
    >
      {visible.map(({ name, label, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: label,
            tabBarAccessibilityLabel: label,
            tabBarIcon: ({ color }) => <Icon color={color} size={isDesktop ? 21 : 23} />,
          }}
        />
      ))}

      <Tabs.Screen
        name="more"
        options={
          isDesktop
            ? { href: null, title: t('more') }
            : {
                title: t('more'),
                tabBarAccessibilityLabel: t('more'),
                tabBarIcon: ({ color }) => <Menu color={color} size={23} />,
              }
        }
      />

      {hidden.map(({ name, label }) => (
        <Tabs.Screen key={name} name={name} options={{ href: null, title: label }} />
      ))}
    </Tabs>
  );
}
