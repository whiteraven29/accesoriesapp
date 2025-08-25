import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { ChartBar as BarChart3, Calendar, TrendingUp, TrendingDown, Package, Users, DollarSign } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { formatCurrency } from '@/utils/currency';
import { useProducts } from '@/hooks/useProducts';
import { useCustomers } from '@/hooks/useCustomers';
import { useSales } from '@/hooks/useSales';

export default function ReportsScreen() {
  const { t } = useLanguage();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { sales, getTotalSales } = useSales();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  const calculateProfitLoss = () => {
    const totalRevenue = getTotalSales();
    const totalCost = products.reduce((total, product) => 
      total + (product.buyingPrice * (product.pieces || 0)), 0
    );
    const profit = totalRevenue - totalCost;
    
    return {
      revenue: totalRevenue,
      cost: totalCost,
      profit,
      margin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
    };
  };

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
    // This would normally come from sales data
    return products.slice(0, 5);
  };

  const profitLoss = calculateProfitLoss();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports & Analytics</Text>
      </View>

      <View style={styles.periodSelector}>
        {['today', 'week', 'month'].map(period => (
          <TouchableOpacity
            key={period}
            style={[styles.periodButton, selectedPeriod === period && styles.activePeriod]}
            onPress={() => setSelectedPeriod(period as any)}
          >
            <Text style={[styles.periodText, selectedPeriod === period && styles.activePeriodText]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profit & Loss Summary */}
        <Text style={styles.sectionTitle}>Profit & Loss Summary</Text>
        <View style={styles.profitLossCard}>
          <View style={styles.profitLossHeader}>
            <Text style={styles.profitLossTitle}>Financial Overview</Text>
            <Calendar size={20} color="#6B7280" />
          </View>
          
          <View style={styles.profitLossGrid}>
            <View style={styles.profitLossItem}>
              <Text style={styles.profitLossLabel}>Total Revenue</Text>
              <Text style={[styles.profitLossValue, { color: '#16A34A' }]}>
                {formatCurrency(profitLoss.revenue)}
              </Text>
            </View>
            
            <View style={styles.profitLossItem}>
              <Text style={styles.profitLossLabel}>Total Cost</Text>
              <Text style={[styles.profitLossValue, { color: '#DC2626' }]}>
                {formatCurrency(profitLoss.cost)}
              </Text>
            </View>
            
            <View style={styles.profitLossItem}>
              <Text style={styles.profitLossLabel}>Net Profit</Text>
              <Text style={[
                styles.profitLossValue, 
                { color: profitLoss.profit >= 0 ? '#16A34A' : '#DC2626', fontSize: 20, fontWeight: 'bold' }
              ]}>
                {formatCurrency(profitLoss.profit)}
              </Text>
            </View>
            
            <View style={styles.profitLossItem}>
              <Text style={styles.profitLossLabel}>Profit Margin</Text>
              <Text style={[
                styles.profitLossValue, 
                { color: profitLoss.margin >= 0 ? '#16A34A' : '#DC2626' }
              ]}>
                {profitLoss.margin.toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Key Metrics */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Sales"
            value={formatCurrency(profitLoss.revenue)}
            icon={<DollarSign size={24} color="#2563EB" />}
            trend="up"
            trendValue={8.5}
          />
          <StatCard
            title="Inventory Value"
            value={formatCurrency(inventory.sellingValue)}
            icon={<Package size={24} color="#7C3AED" />}
            subtitle={`${inventory.totalItems} items`}
            color="#7C3AED"
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            title="Active Customers"
            value={customers.length.toString()}
            icon={<Users size={24} color="#16A34A" />}
            trend="up"
            trendValue={12.3}
            color="#16A34A"
          />
          <StatCard
            title="Pending Loans"
            value={formatCurrency(customers.reduce((total, c) => total + c.loanBalance, 0))}
            icon={<TrendingDown size={24} color="#D97706" />}
            color="#D97706"
          />
        </View>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Low Stock Alert ({lowStockItems.length} items)</Text>
            <View style={styles.lowStockCard}>
              {lowStockItems.map(product => (
                <View key={product.id} style={styles.lowStockItem}>
                  <View>
                    <Text style={styles.lowStockName}>{product.name}</Text>
                    <Text style={styles.lowStockBrand}>{product.brand}</Text>
                  </View>
                  <View style={styles.lowStockQty}>
                    <Text style={styles.lowStockNumber}>{product.pieces}</Text>
                    <Text style={styles.lowStockLabel}>remaining</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top Products */}
        <Text style={styles.sectionTitle}>Product Performance</Text>
        <View style={styles.topProductsCard}>
          {topProducts.map((product, index) => (
            <View key={product.id} style={styles.topProductItem}>
              <View style={styles.productRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productBrand}>{product.brand}</Text>
              </View>
              <View style={styles.productStats}>
                <Text style={styles.productValue}>{formatCurrency(product.sellingPrice * product.pieces)}</Text>
                <Text style={styles.productQty}>{product.pieces} units</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Customer Insights */}
        <Text style={styles.sectionTitle}>Customer Insights</Text>
        <View style={styles.customerInsights}>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>Total Loyalty Points</Text>
            <Text style={styles.insightValue}>
              {customers.reduce((total, c) => total + c.loyaltyPoints, 0)}
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>Customers with Loans</Text>
            <Text style={styles.insightValue}>
              {customers.filter(c => c.loanBalance > 0).length}
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Text style={styles.insightLabel}>Average Loan</Text>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activePeriod: {
    backgroundColor: '#2563EB',
  },
  periodText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  activePeriodText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    marginTop: 16,
  },
  profitLossCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profitLossHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  profitLossTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  profitLossGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  profitLossItem: {
    width: '47%',
  },
  profitLossLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  profitLossValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
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
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  lowStockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lowStockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lowStockName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  lowStockBrand: {
    fontSize: 12,
    color: '#6B7280',
  },
  lowStockQty: {
    alignItems: 'center',
  },
  lowStockNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  lowStockLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
  topProductsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  productBrand: {
    fontSize: 12,
    color: '#6B7280',
  },
  productStats: {
    alignItems: 'flex-end',
  },
  productValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  productQty: {
    fontSize: 12,
    color: '#6B7280',
  },
  customerInsights: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  insightLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  insightValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
});