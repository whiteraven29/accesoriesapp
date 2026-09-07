import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  Package,
  Users,
  ShoppingCart,
  CircleAlert as AlertCircle,
  ShieldAlert,
  BarChart3,
  LogOut,
  RefreshCw,
  Receipt,
} from 'lucide-react-native';
import { Palette, elevation, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';
import { useCustomers } from '../../hooks/useCustomers';
import { useSales } from '../../hooks/useSales';
import { useAuth } from '../../hooks/useAuth';
import { useResponsive } from '../../hooks/useResponsive';
import { grossProfit, lineTotal } from '../../utils/calculations';
import { supabase } from '../../utils/supabase';
import { useState, useEffect, useMemo } from 'react';
import { Screen } from '../../components/Screen';
import { Accent, Card, IconChip, ProgressRing, SectionHeading, StatTile } from '../../components/ui';

/** Small circular icon button — the kit's treatment for a header affordance. */
function RoundAction({
  onPress,
  label,
  disabled,
  children,
  styles,
}: {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.roundAction, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, isSwahili } = useLanguage();
  const { colors: c, scheme } = useTheme();
  const { products, fetchProducts } = useProducts();
  const { customers, fetchCustomers } = useCustomers();
  const { sales, getTodaysSales, fetchSales, getExpiredWarrantySales } = useSales();
  const { user, signOut } = useAuth();
  const { isPhone, isDesktop } = useResponsive();
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<{ username: string; shop_name: string } | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('username, shop_name')
            .eq('id', user.id)
            .single();

          if (!error && profile) {
            setUserProfile(profile);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, []);

  const profitForSales = (periodSales: typeof sales) => periodSales.reduce(
    (total, sale) => total + sale.items.reduce(
      (profit, item) => profit + grossProfit(
        lineTotal(item.price, item.quantity),
        lineTotal(item.buyingPrice, item.quantity)
      ),
      0
    ),
    0
  );
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySales = sales.filter(
    sale => new Date(sale.created_at).toDateString() === yesterday.toDateString()
  );
  const todaySales = getTodaysSales();
  const todayRevenue = todaySales.reduce((total, sale) => total + sale.total, 0);
  const yesterdayRevenue = yesterdaySales.reduce((total, sale) => total + sale.total, 0);
  const todayProfit = profitForSales(todaySales);
  const yesterdayProfit = profitForSales(yesterdaySales);
  const percentageChange = (current: number, previous: number) =>
    previous === 0 ? (current === 0 ? 0 : 100) : ((current - previous) / Math.abs(previous)) * 100;

  // Calculate dashboard data from saved sale values and historical costs.
  const dashboardData = {
    todaySales: todayRevenue,
    todayProfit,
    totalProducts: products.length,
    lowStockItems: products.filter(product => product.pieces <= product.lowStockAlert).length,
    totalCustomers: customers.length,
    pendingLoans: customers.reduce((total, customer) => total + customer.loanBalance, 0),
    expiredWarranties: getExpiredWarrantySales().length,
    salesTrend: percentageChange(todayRevenue, yesterdayRevenue),
    profitTrend: percentageChange(todayProfit, yesterdayProfit),
  };

  /**
   * What the hero ring shows.
   *
   * The reference design puts a "% of today's tasks done" ring here, and a shop
   * has no equivalent target to complete. Gross margin is the honest analogue:
   * it is a real percentage, it moves during the day, and it is the number that
   * decides whether a day of takings was actually worth trading.
   */
  const margin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchProducts(),
        fetchCustomers(),
        fetchSales()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const styles = useMemo(() => createStyles(c, scheme), [c, scheme]);

  const shopName = userProfile?.shop_name || (isSwahili ? 'Duka la Simu' : 'Phone Shop POS');
  const personName =
    userProfile?.username || user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  const stats: { key: string; value: string; icon: React.ReactNode; accent: Accent; tone: 'primary' | 'success' | 'info' | 'danger'; trend?: number }[] = [
    { key: 'todaySales', value: formatCurrency(dashboardData.todaySales),
      icon: <ShoppingCart size={20} color={c.accent.violet} />, accent: 'violet', tone: 'primary',
      trend: dashboardData.salesTrend },
    { key: 'todayProfit', value: formatCurrency(dashboardData.todayProfit),
      icon: <TrendingUp size={20} color={c.accent.green} />, accent: 'green', tone: 'success',
      trend: dashboardData.profitTrend },
    { key: 'totalProducts', value: String(dashboardData.totalProducts),
      icon: <Package size={20} color={c.accent.blue} />, accent: 'blue', tone: 'info' },
    { key: 'totalCustomers', value: String(dashboardData.totalCustomers),
      icon: <Users size={20} color={c.accent.pink} />, accent: 'pink', tone: 'danger' },
  ];

  const alerts = [
    dashboardData.lowStockItems > 0 && {
      key: 'lowStock',
      accent: 'orange' as Accent,
      colour: c.accent.orange,
      title: t('lowStock'),
      description: `${dashboardData.lowStockItems} ${t('itemsLowStock')}`,
      go: () => router.push('/(tabs)/products'),
    },
    dashboardData.pendingLoans > 0 && {
      key: 'pendingLoans',
      accent: 'pink' as Accent,
      colour: c.accent.pink,
      title: t('pendingLoans'),
      description: `${formatCurrency(dashboardData.pendingLoans)} ${t('inPendingLoans')}`,
      go: () => router.push('/(tabs)/customers'),
    },
    // Not a deletion prompt. It tells the shopkeeper the shop's obligation on
    // those handsets has ended; the sale itself stays as a tax and audit record.
    dashboardData.expiredWarranties > 0 && {
      key: 'expiredWarranties',
      accent: 'yellow' as Accent,
      colour: c.accent.yellow,
      icon: 'shield' as const,
      title: t('expiredWarranties'),
      description: `${dashboardData.expiredWarranties} ${t('expiredWarrantiesHint')}`,
      go: () => router.push('/(tabs)/receipts'),
    },
  ].filter(Boolean) as {
    key: string; accent: Accent; colour: string; title: string; description: string;
    icon?: 'shield'; go: () => void;
  }[];

  const actions: { key: string; label: string; accent: Accent; colour: string; icon: React.ReactNode; go: () => void }[] = [
    { key: 'newSale', label: t('newSale'), accent: 'violet', colour: c.accent.violet,
      icon: <ShoppingCart size={22} color={c.accent.violet} />, go: () => router.push('/(tabs)/sales') },
    { key: 'addProduct', label: t('addProduct'), accent: 'green', colour: c.accent.green,
      icon: <Package size={22} color={c.accent.green} />, go: () => router.push('/(tabs)/products') },
    { key: 'addCustomer', label: t('addCustomer'), accent: 'blue', colour: c.accent.blue,
      icon: <Users size={22} color={c.accent.blue} />, go: () => router.push('/(tabs)/customers') },
    { key: 'viewReports', label: t('viewReports'), accent: 'pink', colour: c.accent.pink,
      icon: <BarChart3 size={22} color={c.accent.pink} />, go: () => router.push('/(tabs)/reports') },
    { key: 'receipts', label: t('receipts'), accent: 'yellow', colour: c.accent.yellow,
      icon: <Receipt size={22} color={c.accent.yellow} />, go: () => router.push('/(tabs)/receipts') },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={handleRefresh}>
      {/* Greeting row: who is on the till, and the two controls that were
          previously buried in the gradient banner. */}
      <View style={styles.greetingRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{shopName.trim().charAt(0).toUpperCase() || 'D'}</Text>
        </View>
        <View style={styles.greetingText}>
          <Text style={styles.hello}>{isSwahili ? 'Habari!' : 'Hello!'}</Text>
          <Text style={styles.name} numberOfLines={1}>{personName}</Text>
        </View>
        <View style={styles.greetingActions}>
          <RoundAction onPress={handleRefresh} disabled={refreshing} label={t('refresh')} styles={styles}>
            <RefreshCw size={18} color={c.primary} />
          </RoundAction>
          <RoundAction onPress={signOut} label={t('logout')} styles={styles}>
            <LogOut size={18} color={c.primary} />
          </RoundAction>
        </View>
      </View>

      {/* Hero: the day in one card, the way the reference design leads with
          today's progress rather than a grid of equal-weight numbers. */}
      <LinearGradient
        colors={[c.primary, c.primaryPressed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroText}>
          <Text style={styles.heroLabel} numberOfLines={2}>{shopName}</Text>
          <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(dashboardData.todaySales)}
          </Text>
          <Text style={styles.heroCaption}>
            {t('todaySales')} · {new Date().toLocaleDateString(isSwahili ? 'sw-TZ' : 'en-TZ')}
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/reports')}
            accessibilityRole="button"
            accessibilityLabel={t('viewReports')}
            style={({ pressed }) => [styles.heroButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={styles.heroButtonText}>{t('viewReports')}</Text>
          </Pressable>
        </View>
        {/* Drawn on the hero's own dark ground, so it uses a light track rather
            than the pastel tint a ring gets on a white card. */}
        <View style={styles.heroRing}>
          <ProgressRing
            value={margin}
            size={104}
            thickness={9}
            accent="violet"
            label={t('todayProfit')}
            showValue={false}
          />
          <View style={styles.heroRingLabel} pointerEvents="none">
            <Text style={styles.heroRingValue}>{Math.round(margin)}%</Text>
            <Text style={styles.heroRingCaption}>{isSwahili ? 'Faida' : 'Margin'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsGrid}>
        {stats.map(stat => (
          <View
            key={stat.key}
            style={[styles.statCell, { flexBasis: isDesktop ? '22%' : '46%', minWidth: isDesktop ? 200 : 0 }]}
          >
            <StatTile
              label={t(stat.key)}
              value={stat.value}
              icon={stat.icon}
              accent={stat.accent}
              tone={stat.tone}
              trend={stat.trend === undefined ? undefined : {
                direction: stat.trend >= 0 ? 'up' : 'down',
                value: Math.abs(stat.trend),
              }}
            />
          </View>
        ))}
      </View>

      {alerts.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading title={t('alerts')} count={alerts.length} />
          {alerts.map(alert => (
            <Pressable
              key={alert.key}
              onPress={alert.go}
              accessibilityRole="button"
              accessibilityLabel={`${alert.title}. ${alert.description}`}
              style={({ pressed }) => [styles.rowPress, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Card style={styles.rowCard}>
                <IconChip accent={alert.accent}>
                  {alert.icon === 'shield'
                    ? <ShieldAlert size={20} color={alert.colour} />
                    : <AlertCircle size={20} color={alert.colour} />}
                </IconChip>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{alert.title}</Text>
                  <Text style={styles.rowDescription}>{alert.description}</Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeading title={t('quickActions')} />
        <View style={styles.actionGrid}>
          {actions.map(action => (
            <Pressable
              key={action.key}
              onPress={action.go}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.actionCell,
                { flexBasis: isPhone ? '47%' : '31%', opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Card style={styles.actionCard}>
                <IconChip accent={action.accent}>{action.icon}</IconChip>
                <Text style={styles.actionText} numberOfLines={2}>{action.label}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const createStyles = (c: Palette, scheme: 'light' | 'dark') => StyleSheet.create({
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: c.primary, fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  greetingText: { flex: 1 },
  hello: { color: c.textMuted, fontSize: fontSize.md },
  name: { color: c.text, fontSize: fontSize.xxl, fontWeight: fontWeight.bold, letterSpacing: -0.4 },
  greetingActions: { flexDirection: 'row', gap: spacing.sm },
  roundAction: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation(scheme, 1),
  },

  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    ...elevation(scheme, 2),
    shadowColor: c.primary,
    shadowOpacity: scheme === 'dark' ? 0.5 : 0.35,
  },
  heroText: { flex: 1, gap: spacing.xs },
  heroLabel: { color: 'rgba(255,255,255,0.78)', fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  heroValue: { color: '#FFFFFF', fontSize: fontSize.display, fontWeight: fontWeight.bold, letterSpacing: -0.8 },
  heroCaption: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm },
  heroButton: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  heroButtonText: { color: c.primary, fontWeight: fontWeight.bold, fontSize: fontSize.md },
  heroRing: { alignItems: 'center', justifyContent: 'center' },
  // The shared ring's own readout is body-coloured and would vanish on violet,
  // so it is switched off and redrawn here in white.
  heroRingLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroRingValue: { color: '#FFFFFF', fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  heroRingCaption: { color: 'rgba(255,255,255,0.72)', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  statCell: { flexGrow: 1 },

  section: { marginTop: spacing.xxl },
  rowPress: { marginBottom: spacing.md },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1 },
  rowTitle: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  rowDescription: { color: c.textMuted, fontSize: fontSize.md, marginTop: 2 },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCell: { flexGrow: 1 },
  actionCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  actionText: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'center' },
});
