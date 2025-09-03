import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown, Package, Users, ShoppingCart, CircleAlert as AlertCircle, BarChart3, LogOut, RefreshCw } from 'lucide-react-native';
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
    todayProfit: getTodaysSales().reduce((total, sale) => total + (sale.total - sale.items.reduce((cost, item) => {
      const product = products.find(p => p.id === item.productId);
      return cost + (product ? product.buyingPrice * item.quantity : 0);
    }, 0)), 0),
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
              <TrendingUp size={16} color="#16A34A" />
            ) : (
              <TrendingDown size={16} color="#DC2626" />
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

  const styles = createStyles(width);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
          icon={<ShoppingCart size={24} color="#2563EB" />}
          trend="up"
          trendValue={dashboardData.salesTrend}
        />
        <StatCard
          title={t('todayProfit')}
          value={formatCurrency(dashboardData.todayProfit)}
          icon={<TrendingUp size={24} color="#16A34A" />}
          trend="down"
          trendValue={Math.abs(dashboardData.profitTrend)}
          color="#16A34A"
        />
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          title={t('totalProducts')}
          value={dashboardData.totalProducts.toString()}
          icon={<Package size={24} color="#7C3AED" />}
          color="#7C3AED"
        />
        <StatCard
          title={t('totalCustomers')}
          value={dashboardData.totalCustomers.toString()}
          icon={<Users size={24} color="#DC2626" />}
          color="#DC2626"
        />
      </View>

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
                    <ShoppingCart size={32} color="#2563EB" />
                    <Text style={styles.actionText}>{t('newSale')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/products')}>
                    <Package size={32} color="#16A34A" />
                    <Text style={styles.actionText}>{t('addProduct')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/customers')}>
                    <Users size={32} color="#7C3AED" />
                    <Text style={styles.actionText}>{t('addCustomer')}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/(tabs)/reports')}>
                    <BarChart3 size={32} color="#DC2626" />
                    <Text style={styles.actionText}>{t('viewReports')}</Text>
                  </TouchableOpacity>
                </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (width: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: width * 0.05,
    paddingTop: width * 0.12,
    borderBottomLeftRadius: width * 0.05,
    borderBottomRightRadius: width * 0.05,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  logoutButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  refreshButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  refreshingButton: {
    opacity: 0.6,
  },
  greeting: {
    fontSize: width * 0.04,
    color: '#E5E7EB',
    marginBottom: width * 0.01,
  },
  businessName: {
    fontSize: width * 0.07,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: width * 0.01,
  },
  date: {
    fontSize: width * 0.035,
    color: '#CBD5E1',
    marginTop: width * 0.02,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: width * 0.03,
    marginTop: width * 0.03,
    gap: width * 0.025,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: width * 0.03,
    borderRadius: width * 0.03,
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
    marginBottom: width * 0.025,
  },
  iconContainer: {
    width: width * 0.12,
    height: width * 0.12,
    borderRadius: width * 0.025,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.02,
    paddingVertical: width * 0.01,
    borderRadius: width * 0.015,
    gap: width * 0.01,
  },
  trendText: {
    fontSize: width * 0.03,
    fontWeight: '600',
  },
  statValue: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.01,
  },
  statTitle: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  alertsSection: {
    padding: width * 0.03,
    marginTop: width * 0.02,
  },
  sectionTitle: {
    fontSize: width * 0.05,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.03,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    padding: width * 0.03,
    borderRadius: width * 0.025,
    marginBottom: width * 0.02,
    flexDirection: 'row',
    alignItems: 'center',
    gap: width * 0.03,
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
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#111827',
    marginBottom: width * 0.005,
  },
  alertDescription: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  quickActions: {
    padding: width * 0.03,
    paddingBottom: width * 0.06,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: width * 0.025,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    padding: width * 0.04,
    borderRadius: width * 0.03,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    marginTop: width * 0.02,
    fontSize: width * 0.035,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});