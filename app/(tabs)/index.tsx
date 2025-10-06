import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown, Package, Users, ShoppingCart, CircleAlert as AlertCircle, BarChart3, LogOut, RefreshCw, Receipt } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';
import { useCustomers } from '../../hooks/useCustomers';
import { useSales } from '../../hooks/useSales';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../utils/supabase';
import { useState, useEffect } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const { t, isSwahili } = useLanguage();
  const { products, fetchProducts } = useProducts();
  const { customers, fetchCustomers } = useCustomers();
  const { sales, getTodaysSales, getTotalSales, fetchSales } = useSales();
  const { user, signOut } = useAuth();
  const { width, height } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<{username: string, shop_name: string} | null>(null);
  const isWideScreen = width > 1024;
  const isTablet = width > 768 && width <= 1024;

  // Responsive scaling with maximum caps
  const scaleFactor = Math.min(width / 375, 2.2); // Base on iPhone 6 width, max 2.2x for desktop

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

  // Calculate dashboard data from real data
  const dashboardData = {
    todaySales: getTodaysSales().reduce((total, sale) => total + sale.total, 0),
    todayProfit: getTodaysSales().reduce((total, sale) => {
      return total + sale.items.reduce((profit, item) => {
        const product = products.find(p => p.id === item.productId);
        return profit + (product ? (item.quantity * (product.sellingPrice - product.buyingPrice)) : 0);
      }, 0);
    }, 0),
    totalProducts: products.length,
    lowStockItems: products.filter(product => product.pieces <= product.lowStockAlert).length,
    totalCustomers: customers.length,
    pendingLoans: customers.reduce((total, customer) => total + customer.loanBalance, 0),
    salesTrend: 0, // This would need to be calculated from historical data
    profitTrend: 0, // This would need to be calculated from historical data
  };

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

  const StatCard = ({
    title,
    value,
    icon,
    trend,
    trendValue,
    color = '#2563EB'
  }: {
    title: string;
    value: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down';
    trendValue?: number;
    color?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          {icon}
        </View>
        {trend && (
          <View style={[styles.trendContainer, { backgroundColor: trend === 'up' ? '#16A34A20' : '#DC262620' }]}>
            {trend === 'up' ? (
              <TrendingUp size={Math.min(16 * scaleFactor, 18)} color="#16A34A" />
            ) : (
              <TrendingDown size={Math.min(16 * scaleFactor, 18)} color="#DC2626" />
            )}
            <Text style={[styles.trendText, { color: trend === 'up' ? '#16A34A' : '#DC2626' }]}>
              {trendValue}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const styles = createStyles(width, isWideScreen, scaleFactor);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.contentWrapper}>
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          style={styles.header}
        >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {isSwahili ? 'Habari!' : 'Hello!'} {user?.user_metadata?.username || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={styles.businessName}>
              {userProfile?.shop_name || (isSwahili ? 'Duka la Simu' : 'Phone Shop POS')}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.refreshButton, refreshing && styles.refreshingButton]}
              onPress={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={signOut}
            >
              <LogOut size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.date}>
          {new Date().toLocaleDateString(isSwahili ? 'sw-TZ' : 'en-TZ')}
        </Text>
      </LinearGradient>

      <View style={styles.statsGrid}>
        <StatCard
          title={t('todaySales')}
          value={formatCurrency(dashboardData.todaySales)}
          icon={<ShoppingCart size={Math.min(24 * scaleFactor, 28)} color="#2563EB" />}
          trend="up"
          trendValue={dashboardData.salesTrend}
        />
        <StatCard
          title={t('todayProfit')}
          value={formatCurrency(dashboardData.todayProfit)}
          icon={<TrendingUp size={Math.min(24 * scaleFactor, 28)} color="#16A34A" />}
          trend="down"
          trendValue={Math.abs(dashboardData.profitTrend)}
          color="#16A34A"
        />
        {isWideScreen && (
          <StatCard
            title={t('totalProducts')}
            value={dashboardData.totalProducts.toString()}
            icon={<Package size={Math.min(24 * scaleFactor, 28)} color="#7C3AED" />}
            color="#7C3AED"
          />
        )}
      </View>

      {!isWideScreen && (
        <View style={styles.statsGrid}>
          <StatCard
            title={t('totalProducts')}
            value={dashboardData.totalProducts.toString()}
            icon={<Package size={Math.min(24 * scaleFactor, 28)} color="#7C3AED" />}
            color="#7C3AED"
          />
          <StatCard
            title={t('totalCustomers')}
            value={dashboardData.totalCustomers.toString()}
            icon={<Users size={Math.min(24 * scaleFactor, 28)} color="#DC2626" />}
            color="#DC2626"
          />
        </View>
      )}

      {isWideScreen && (
        <View style={styles.statsGrid}>
          <StatCard
            title={t('totalCustomers')}
            value={dashboardData.totalCustomers.toString()}
            icon={<Users size={Math.min(24 * scaleFactor, 28)} color="#DC2626" />}
            color="#DC2626"
          />
        </View>
      )}

      <View style={styles.alertsSection}>
        <Text style={styles.sectionTitle}>{t('alerts')}</Text>
        
        {dashboardData.lowStockItems > 0 && (
          <TouchableOpacity style={styles.alertCard}>
            <AlertCircle size={20} color="#D97706" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{t('lowStock')}</Text>
              <Text style={styles.alertDescription}>
                {dashboardData.lowStockItems} {t('itemsLowStock')}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {dashboardData.pendingLoans > 0 && (
          <TouchableOpacity style={styles.alertCard}>
            <AlertCircle size={20} color="#DC2626" />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>{t('pendingLoans')}</Text>
              <Text style={styles.alertDescription}>
                {formatCurrency(dashboardData.pendingLoans)} {t('inPendingLoans')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>{t('quickActions')}</Text>

        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/sales')}>
            <ShoppingCart size={Math.min(32 * scaleFactor, 36)} color="#2563EB" />
            <Text style={styles.actionText}>{t('newSale')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/products')}>
            <Package size={Math.min(32 * scaleFactor, 36)} color="#16A34A" />
            <Text style={styles.actionText}>{t('addProduct')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/customers')}>
            <Users size={Math.min(32 * scaleFactor, 36)} color="#7C3AED" />
            <Text style={styles.actionText}>{t('addCustomer')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/reports')}>
            <BarChart3 size={Math.min(32 * scaleFactor, 36)} color="#DC2626" />
            <Text style={styles.actionText}>{t('viewReports')}</Text>
          </TouchableOpacity>

          {isWideScreen && (
            <>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/receipts')}>
                <Receipt size={Math.min(32 * scaleFactor, 36)} color="#F59E0B" />
                <Text style={styles.actionText}>{t('receipts')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
              </View>
            </ScrollView>
          );
}

const createStyles = (width: number, isWideScreen: boolean, scaleFactor: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  contentWrapper: {
    flex: 1,
    maxWidth: Math.min(width, 1200), // Max width for large screens
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    padding: Math.min(20 * scaleFactor, 40),
    paddingTop: Math.min(40 * scaleFactor, 60),
    borderBottomLeftRadius: Math.min(20 * scaleFactor, 30),
    borderBottomRightRadius: Math.min(20 * scaleFactor, 30),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: Math.min(8 * scaleFactor, 16),
  },
  logoutButton: {
    padding: Math.min(8 * scaleFactor, 16),
    borderRadius: Math.min(8 * scaleFactor, 16),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  refreshButton: {
    padding: Math.min(8 * scaleFactor, 16),
    borderRadius: Math.min(8 * scaleFactor, 16),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  refreshingButton: {
    opacity: 0.6,
  },
  greeting: {
    fontSize: Math.min(16 * scaleFactor, 20),
    color: '#E5E7EB',
    marginBottom: Math.min(4 * scaleFactor, 8),
  },
  businessName: {
    fontSize: Math.min(24 * scaleFactor, 32),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: Math.min(4 * scaleFactor, 8),
  },
  date: {
    fontSize: Math.min(14 * scaleFactor, 18),
    color: '#CBD5E1',
    marginTop: Math.min(8 * scaleFactor, 16),
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: Math.min(12 * scaleFactor, 24),
    marginTop: Math.min(12 * scaleFactor, 24),
    gap: Math.min(10 * scaleFactor, 20),
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: Math.min(12 * scaleFactor, 24),
    borderRadius: Math.min(12 * scaleFactor, 20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Math.min(10 * scaleFactor, 20),
  },
  iconContainer: {
    width: Math.min(48 * scaleFactor, 60),
    height: Math.min(48 * scaleFactor, 60),
    borderRadius: Math.min(10 * scaleFactor, 15),
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Math.min(8 * scaleFactor, 16),
    paddingVertical: Math.min(4 * scaleFactor, 8),
    borderRadius: Math.min(6 * scaleFactor, 12),
    gap: Math.min(4 * scaleFactor, 8),
  },
  trendText: {
    fontSize: Math.min(12 * scaleFactor, 16),
    fontWeight: '600',
  },
  statValue: {
    fontSize: Math.min(24 * scaleFactor, 32),
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: Math.min(4 * scaleFactor, 8),
  },
  statTitle: {
    fontSize: Math.min(14 * scaleFactor, 18),
    color: '#6B7280',
  },
  alertsSection: {
    padding: Math.min(12 * scaleFactor, 24),
    marginTop: Math.min(8 * scaleFactor, 16),
  },
  sectionTitle: {
    fontSize: Math.min(20 * scaleFactor, 24),
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: Math.min(12 * scaleFactor, 24),
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    padding: Math.min(12 * scaleFactor, 24),
    borderRadius: Math.min(10 * scaleFactor, 16),
    marginBottom: Math.min(8 * scaleFactor, 16),
    flexDirection: 'row',
    alignItems: 'center',
    gap: Math.min(12 * scaleFactor, 24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: Math.min(16 * scaleFactor, 20),
    fontWeight: '600',
    color: '#111827',
    marginBottom: Math.min(2 * scaleFactor, 4),
  },
  alertDescription: {
    fontSize: Math.min(14 * scaleFactor, 18),
    color: '#6B7280',
  },
  quickActions: {
    padding: Math.min(12 * scaleFactor, 24),
    paddingBottom: Math.min(24 * scaleFactor, 40),
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: isWideScreen ? Math.min(20 * scaleFactor, 24) : Math.min(10 * scaleFactor, 16),
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    padding: isWideScreen ? Math.min(24 * scaleFactor, 28) : Math.min(16 * scaleFactor, 20),
    borderRadius: isWideScreen ? Math.min(16 * scaleFactor, 20) : Math.min(12 * scaleFactor, 16),
    width: isWideScreen ? '18%' : '47%',
    minWidth: isWideScreen ? Math.min(140 * scaleFactor, 160) : undefined,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    marginTop: Math.min(8 * scaleFactor, 12),
    fontSize: Math.min(14 * scaleFactor, 16),
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});