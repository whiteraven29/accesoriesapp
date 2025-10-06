import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions } from 'react-native';
import { ChartBar as BarChart3, Calendar, TrendingUp, TrendingDown, Package, Users, DollarSign, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';
import { useCustomers } from '../../hooks/useCustomers';
import { useSales } from '../../hooks/useSales';
import { supabase } from '../../utils/supabase';

export default function ReportsScreen() {
  const { t } = useLanguage();
  const { products, fetchProducts } = useProducts();
  const { customers, fetchCustomers } = useCustomers();
  const { sales, getTotalSales, fetchSales } = useSales();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [profitLoss, setProfitLoss] = useState({
    revenue: 0,
    cost: 0,
    profit: 0,
    margin: 0,
  });
  const { width } = useWindowDimensions();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProducts(),
      fetchCustomers(),
      fetchSales()
    ]);
    setRefreshing(false);
  };

  const getDateRange = (period: 'today' | 'week' | 'month') => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - dayOfWeek), 23, 59, 59);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    return { startDate, endDate };
  };

  useEffect(() => {
    const calculateProfitLoss = async () => {
      const { startDate, endDate } = getDateRange(selectedPeriod);
      const totalRevenue = getTotalSales(startDate, endDate);

      // Calculate actual cost of goods sold by joining sale_items with products
      const { data: saleItemsWithProducts, error } = await supabase
        .from('sale_items')
        .select(`
          quantity,
          products!inner(buying_price),
          sales!inner(created_at)
        `)
        .gte('sales.created_at', startDate.toISOString())
        .lte('sales.created_at', endDate.toISOString());

      if (error) {
        console.error('Error fetching sale items with products:', error);
        setProfitLoss({
          revenue: totalRevenue,
          cost: 0,
          profit: totalRevenue,
          margin: 100,
        });
        return;
      }

      const totalCost = (saleItemsWithProducts || []).reduce((total: number, item: any) =>
        total + (item.products.buying_price * item.quantity), 0
      );

      const profit = totalRevenue - totalCost;

      setProfitLoss({
        revenue: totalRevenue,
        cost: totalCost,
        profit,
        margin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
      });
    };

    calculateProfitLoss();
  }, [sales, getTotalSales, selectedPeriod]);

  const getInventoryValue = () => {
    return {
      buyingValue: products.reduce((total, product) => total + (product.buyingPrice * product.pieces), 0),
      sellingValue: products.reduce((total, product) => total + (product.sellingPrice * product.pieces), 0),
      totalItems: products.reduce((total, product) => total + product.pieces, 0),
    };
  };

  const getLowStockItems = () => {
    return products.filter(product => product.pieces <= product.lowStockAlert);
  };

  const getTopSellingProducts = () => {
    // Calculate top selling products based on actual sales data
    const productSales: { [key: string]: number } = {};

    // Aggregate sales by product
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (productSales[item.productId]) {
          productSales[item.productId] += item.quantity;
        } else {
          productSales[item.productId] = item.quantity;
        }
      });
    });

    // Sort products by sales quantity
    const sortedProducts = products
      .map(product => ({
        ...product,
        totalSold: productSales[product.id] || 0
      }))
      .sort((a, b) => b.totalSold - a.totalSold);

    return sortedProducts.slice(0, 5);
  };

  const inventory = getInventoryValue();
  const lowStockItems = getLowStockItems();
  const topProducts = getTopSellingProducts();

  const StatCard = ({ 
    title, 
    value, 
    icon, 
    trend, 
    trendValue, 
    color = '#2563EB',
    subtitle 
  }: {
    title: string;
    value: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down';
    trendValue?: number;
    color?: string;
    subtitle?: string;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          {icon}
        </View>
        {trend && trendValue !== undefined && (
          <View style={[styles.trendContainer, { backgroundColor: trend === 'up' ? '#16A34A20' : '#DC262620' }]}>
            {trend === 'up' ? (
              <TrendingUp size={14} color="#16A34A" />
            ) : (
              <TrendingDown size={14} color="#DC2626" />
            )}
            <Text style={[styles.trendText, { color: trend === 'up' ? '#16A34A' : '#DC2626' }]}>
              {Math.abs(trendValue).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  const styles = createStyles(width);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('reports')}</Text>
        <TouchableOpacity
          style={[styles.refreshButton, refreshing && styles.refreshingButton]}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.periodSelector}>
        {['today', 'week', 'month'].map(period => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.activePeriod]}
            onPress={() => setSelectedPeriod(period as any)}
          >
            <Text style={[styles.periodText, selectedPeriod === period && styles.activePeriodText]}>
              {t(period)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Financial Summary */}
        <Text style={styles.sectionTitle}>{t('financialSummary')}</Text>
        <View style={styles.financialSummaryCard}>
          <View style={styles.financialSummarySides}>
            <View style={[styles.financialSide, profitLoss.profit >= 0 ? styles.profitSide : styles.lossSide]}>
              <Text style={styles.financialSideTitle}>
                {profitLoss.profit >= 0 ? t('profit') : t('loss')}
              </Text>
              <Text style={styles.financialSideValue}>
                {formatCurrency(Math.abs(profitLoss.profit))}
              </Text>
            </View>
          </View>
          <View style={styles.financialDetails}>
            <Text style={styles.financialDetail}>
              {t('revenue')}: {formatCurrency(profitLoss.revenue)}
            </Text>
            <Text style={styles.financialDetail}>
              {t('cost')}: {formatCurrency(profitLoss.cost)}
            </Text>
            <Text style={styles.financialDetail}>
              {t('profitMargin')}: {profitLoss.margin.toFixed(2)}%
            </Text>
          </View>
        </View>

        {/* Key Metrics */}
        <Text style={styles.sectionTitle}>{t('keyMetrics')}</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title={t('totalSales')}
            value={formatCurrency(profitLoss.revenue)}
            icon={<DollarSign size={24} color="#2563EB" />}
            trend="up"
            trendValue={8.5}
          />
          <StatCard
            title={t('inventoryValue')}
            value={formatCurrency(inventory.sellingValue)}
            icon={<Package size={24} color="#7C3AED" />}
            subtitle={`${inventory.totalItems} ${t('items')}`}
            color="#7C3AED"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title={t('activeCustomers')}
            value={customers.length.toString()}
            icon={<Users size={24} color="#16A34A" />}
            trend="up"
            trendValue={12.3}
            color="#16A34A"
          />
          <StatCard
            title={t('totalLoans')}
            value={formatCurrency(customers.reduce((total, c) => total + c.loanBalance, 0))}
            icon={<TrendingDown size={24} color="#D97706" />}
            color="#D97706"
          />
        </View>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t('lowStockAlertReport')} ({lowStockItems.length} {t('items')})</Text>
            <View style={styles.lowStockCard}>
              {lowStockItems.map(product => (
                <View key={product.id} style={styles.lowStockItem}>
                  <View>
                    <Text style={styles.lowStockName}>{product.name}</Text>
                    <Text style={styles.lowStockBrand}>{product.brand}</Text>
                  </View>
                  <View style={styles.lowStockQty}>
                    <Text style={styles.lowStockNumber}>{product.pieces}</Text>
                    <Text style={styles.lowStockLabel}>{t('remaining')}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Product Performance */}
        <Text style={styles.sectionTitle}>{t('productPerformance')}</Text>
        <View style={styles.productPerformanceCard}>
          {topProducts.map((product, index) => (
            <View key={product.id} style={styles.productPerformanceItem}>
              <View style={styles.productRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productBrand}>{product.brand}</Text>
              </View>
              <View style={styles.productStats}>
                <Text style={styles.productValue}>
                  {product.totalSold} {t('piecesSold')}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Customer Insights */}
        <Text style={styles.sectionTitle}>{t('customerInsights')}</Text>
        <View style={styles.customerInsights}>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>{t('totalLoyaltyPoints')}</Text>
            <Text style={styles.insightValue}>
              {customers.reduce((total, c) => total + c.loyaltyPoints, 0)}
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>{t('customersWithLoans')}</Text>
            <Text style={styles.insightValue}>
              {customers.filter(c => c.loanBalance > 0).length}
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>{t('averageLoan')}</Text>
            <Text style={styles.insightValue}>
              {formatCurrency(
                customers.filter(c => c.loanBalance > 0).length > 0
                  ? customers.reduce((total, c) => total + c.loanBalance, 0) /
                    customers.filter(c => c.loanBalance > 0).length
                  : 0
              )}
            </Text>
          </View>
        </View>

        {/* Discount Summary */}
        <Text style={styles.sectionTitle}>{t('discountSummary')}</Text>
        <View style={styles.customerInsights}>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>{t('totalDiscountsGiven')}</Text>
            <Text style={styles.insightValue}>
              {formatCurrency(0)} {/* Placeholder - would need discount tracking */}
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>{t('averageDiscount')}</Text>
            <Text style={styles.insightValue}>
              {formatCurrency(0)} {/* Placeholder - would need discount tracking */}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (width: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: width * 0.04,
    paddingTop: width * 0.15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#111827',
  },
  refreshButton: {
    backgroundColor: '#7C3AED',
    width: width * 0.1,
    height: width * 0.1,
    borderRadius: width * 0.05,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshingButton: {
    opacity: 0.6,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: width * 0.04,
    paddingVertical: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: width * 0.02,
  },
  periodButton: {
    flex: 1,
    paddingVertical: width * 0.02,
    paddingHorizontal: width * 0.04,
    borderRadius: width * 0.02,
    alignItems: 'center',
  },
  activePeriod: {
    backgroundColor: '#2563EB',
  },
  periodText: {
    fontSize: width * 0.035,
    color: '#6B7280',
    fontWeight: '600',
  },
  activePeriodText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: width * 0.04,
  },
  sectionTitle: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.03,
    marginTop: width * 0.04,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: width * 0.04,
    marginBottom: width * 0.04,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.04,
    padding: width * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: width * 0.04,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  iconContainer: {
    width: width * 0.1,
    height: width * 0.1,
    borderRadius: width * 0.05,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.02,
    paddingVertical: width * 0.01,
    borderRadius: width * 0.02,
  },
  trendText: {
    fontSize: width * 0.03,
    marginLeft: width * 0.01,
  },
  statValue: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
  },
  statTitle: {
    fontSize: width * 0.035,
    color: '#6B7280',
    marginTop: width * 0.01,
  },
  statSubtitle: {
    fontSize: width * 0.03,
    color: '#9CA3AF',
    marginTop: width * 0.01,
  },
  financialSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.04,
    padding: width * 0.04,
    marginBottom: width * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  financialSummarySides: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: width * 0.03,
  },
  financialSide: {
    flex: 1,
    padding: width * 0.04,
    borderRadius: width * 0.04,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profitSide: {
    backgroundColor: '#16A34A20',
  },
  lossSide: {
    backgroundColor: '#DC262620',
  },
  financialSideTitle: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
  },
  financialSideValue: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
  },
  financialDetails: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: width * 0.03,
  },
  financialDetail: {
    fontSize: width * 0.035,
    color: '#6B7280',
    marginBottom: width * 0.01,
  },
  productPerformanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.04,
    padding: width * 0.04,
    marginBottom: width * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productPerformanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productRank: {
    width: width * 0.08,
    height: width * 0.08,
    borderRadius: width * 0.04,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: width * 0.03,
  },
  rankNumber: {
    color: '#FFFFFF',
    fontSize: width * 0.035,
    fontWeight: 'bold',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: width * 0.035,
    fontWeight: '600',
    color: '#111827',
  },
  productBrand: {
    fontSize: width * 0.03,
    color: '#6B7280',
  },
  productStats: {
    alignItems: 'flex-end',
  },
  productValue: {
    fontSize: width * 0.035,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  productQty: {
    fontSize: width * 0.03,
    color: '#6B7280',
  },
  customerInsights: {
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.04,
    padding: width * 0.04,
    marginBottom: width * 0.08,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  insightLabel: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  insightValue: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
  },
  lowStockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.04,
    padding: width * 0.04,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: width * 0.04,
  },
  lowStockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: width * 0.02,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lowStockName: {
    fontSize: width * 0.035,
    fontWeight: '600',
    color: '#111827',
  },
  lowStockBrand: {
    fontSize: width * 0.03,
    color: '#6B7280',
  },
  lowStockQty: {
    alignItems: 'flex-end',
  },
  lowStockLabel: {
    fontSize: width * 0.03,
    color: '#9CA3AF',
  },
  lowStockNumber: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#DC2626',
  },
});