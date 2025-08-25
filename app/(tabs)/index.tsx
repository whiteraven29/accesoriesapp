import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, TrendingDown, Package, Users, ShoppingCart, CircleAlert as AlertCircle, BarChart3, Languages } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { formatCurrency } from '@/utils/currency';

export default function HomeScreen() {
  const { t, isSwahili, toggleLanguage } = useLanguage();
  
  // Mock data - in real app, this would come from your state management/API
  const dashboardData = {
    todaySales: 850000,
    todayProfit: 285000,
    totalProducts: 342,
    lowStockItems: 12,
    totalCustomers: 156,
    pendingLoans: 450000,
    salesTrend: 12.5,
    profitTrend: -2.3,
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

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {isSwahili ? 'Habari za asubuhi!' : 'Good Morning!'}
            </Text>
            <Text style={styles.businessName}>
              {isSwahili ? 'Duka la Simu' : 'Phone Shop POS'}
            </Text>
          </View>
          <TouchableOpacity style={styles.languageButton} onPress={toggleLanguage}>
            <Languages size={24} color="#FFFFFF" />
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.actionCard}>
            <ShoppingCart size={32} color="#2563EB" />
            <Text style={styles.actionText}>{t('newSale')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard}>
            <Package size={32} color="#16A34A" />
            <Text style={styles.actionText}>{t('addProduct')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard}>
            <Users size={32} color="#7C3AED" />
            <Text style={styles.actionText}>{t('addCustomer')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard}>
            <BarChart3 size={32} color="#DC2626" />
            <Text style={styles.actionText}>{t('viewReports')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: 16,
    color: '#E5E7EB',
    marginBottom: 4,
  },
  businessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  languageButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  date: {
    fontSize: 14,
    color: '#CBD5E1',
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
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
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  alertsSection: {
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  alertDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  quickActions: {
    padding: 16,
    paddingBottom: 32,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    width: '47%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
});