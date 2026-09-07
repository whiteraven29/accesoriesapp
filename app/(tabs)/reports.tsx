import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions } from 'react-native';
import { ChartBar as BarChart3, Calendar, TrendingUp, TrendingDown, Package, Users, DollarSign, RefreshCw } from 'lucide-react-native';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { Palette, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';
import { useCustomers } from '../../hooks/useCustomers';
import { useSales } from '../../hooks/useSales';
import { useLosses } from '../../hooks/useLosses';
import { useExpenses } from '../../hooks/useExpenses';
import { supabase } from '../../utils/supabase';
import { grossMarginPercentage, grossProfit, lineTotal } from '../../utils/calculations';

/**
 * Report metric tile. Module scope so it is not redeclared as a fresh component
 * type on every render of the reports screen.
 */
function StatCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  color,
  subtitle,
  styles,
  c,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
  trendValue?: number;
  color?: string;
  subtitle?: string;
  styles: ReturnType<typeof createStyles>;
  c: Palette;
}) {
  const accent = color ?? c.primary;
  const rising = trend === 'up';

  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${accent}20` }]}>{icon}</View>
        {trend && trendValue !== undefined && (
          <View style={[styles.trendContainer, { backgroundColor: rising ? c.successTint : c.dangerTint }]}>
            {rising ? <TrendingUp size={14} color={c.success} /> : <TrendingDown size={14} color={c.danger} />}
            <Text style={[styles.trendText, { color: rising ? c.success : c.danger }]}>
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
}

export default function ReportsScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const { products, fetchProducts } = useProducts();
  const { customers, fetchCustomers } = useCustomers();
  const { sales, fetchSales } = useSales();
  const { losses, fetchLosses } = useLosses();
  const { expenses, fetchExpenses } = useExpenses();
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [profitLoss, setProfitLoss] = useState({
    revenue: 0,
    cost: 0,
    profit: 0,
    margin: 0,
    losses: 0,
    expenses: 0,
  });
  const { width } = useWindowDimensions();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProducts(),
      fetchCustomers(),
      fetchSales(),
      fetchLosses(),
      fetchExpenses()
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
      const periodSales = sales.filter(sale => {
        const createdAt = new Date(sale.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      });
      const totalRevenue = periodSales.reduce((total, sale) => total + sale.total, 0);

      // Use the cost captured at checkout so later price changes do not rewrite history.
      const { data: saleItemsWithProducts, error } = await supabase
        .from('sale_items')
        .select(`
          quantity,
          buying_price,
          sales!inner(created_at)
        `)
        .gte('sales.created_at', startDate.toISOString())
        .lte('sales.created_at', endDate.toISOString());

      if (error) {
        console.error('Error fetching sale items with products:', error);
        setProfitLoss({ revenue: totalRevenue, cost: 0, profit: 0, margin: 0, losses: 0, expenses: 0 });
        return;
      }

      const totalCost = (saleItemsWithProducts || []).reduce((total: number, item: any) =>
        total + lineTotal(Number(item.buying_price), Number(item.quantity)), 0
      );

      const periodLosses = losses
        .filter(loss => {
          const createdAt = new Date(loss.created_at);
          return createdAt >= startDate && createdAt <= endDate;
        })
        .reduce((total, loss) => total + loss.lossValue, 0);
      const periodExpenses = expenses
        .filter(expense => {
          const expenseDate = new Date(`${expense.expenseDate}T00:00:00`);
          return expenseDate >= startDate && expenseDate <= endDate;
        })
        .reduce((total, expense) => total + expense.amount, 0);
      const profit = grossProfit(totalRevenue, totalCost + periodLosses + periodExpenses);

      setProfitLoss({
        revenue: totalRevenue,
        cost: totalCost,
        profit,
        margin: grossMarginPercentage(totalRevenue, totalCost + periodLosses + periodExpenses),
        losses: periodLosses,
        expenses: periodExpenses,
      });
    };

    calculateProfitLoss();
  }, [sales, losses, expenses, selectedPeriod]);

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
    const { startDate, endDate } = getDateRange(selectedPeriod);
    sales
      .filter(sale => {
        const createdAt = new Date(sale.created_at);
        return createdAt >= startDate && createdAt <= endDate;
      })
      .forEach(sale => {
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


  const styles = useMemo(() => createStyles(width, c), [width, c]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('reports')}</Text>
        <TouchableOpacity
          style={[styles.refreshButton, refreshing && styles.refreshingButton]}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={18} color={c.textInverse} />
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
        style={[styles.content, styles.contentColumn]}
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
              {t('lossInformation')}: {formatCurrency(profitLoss.losses)}
            </Text>
            <Text style={styles.financialDetail}>
              {t('operatingExpenses')}: {formatCurrency(profitLoss.expenses)}
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
            styles={styles}
            c={c}
            title={t('totalSales')}
            value={formatCurrency(profitLoss.revenue)}
            icon={<DollarSign size={20} color={c.primary} />}
          />
          <StatCard
            styles={styles}
            c={c}
            title={t('inventoryValue')}
            value={formatCurrency(inventory.sellingValue)}
            icon={<Package size={20} color={c.info} />}
            subtitle={`${inventory.totalItems} ${t('items')}`}
            color={c.info}
          />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            styles={styles}
            c={c}
            title={t('activeCustomers')}
            value={customers.length.toString()}
            icon={<Users size={20} color={c.success} />}
            color={c.success}
          />
          <StatCard
            styles={styles}
            c={c}
            title={t('totalLoans')}
            value={formatCurrency(customers.reduce((total, c) => total + c.loanBalance, 0))}
            icon={<TrendingDown size={20} color={c.warning} />}
            color={c.warning}
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

const createStyles = (viewportWidth: number, c: Palette) => {
  const width = Math.min(Math.max(viewportWidth, 320), 480);
  return StyleSheet.create({
  // Content column cap. These screens size their interior from a viewport
  // clamped to 480px, so without a max width a desktop rendered phone-scale
  // text stretched across the whole monitor.
  contentColumn: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH.wide,
    alignSelf: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: width * 0.04,
    paddingTop: width * 0.04,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: c.text,
  },
  refreshButton: {
    backgroundColor: c.info,
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
    backgroundColor: c.surface,
    paddingHorizontal: width * 0.04,
    paddingVertical: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
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
    backgroundColor: c.primary,
  },
  periodText: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    fontWeight: '600',
  },
  activePeriodText: {
    color: c.textInverse,
  },
  content: {
    flex: 1,
    padding: width * 0.04,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
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
    backgroundColor: c.surface,
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
    fontSize: fontSize.sm,
    marginLeft: width * 0.01,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
  },
  statTitle: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginTop: width * 0.01,
  },
  statSubtitle: {
    fontSize: fontSize.sm,
    color: c.textSubtle,
    marginTop: width * 0.01,
  },
  financialSummaryCard: {
    backgroundColor: c.surface,
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
    backgroundColor: c.successTint,
  },
  lossSide: {
    backgroundColor: c.dangerTint,
  },
  financialSideTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
  },
  financialSideValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
  },
  financialDetails: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: width * 0.03,
  },
  financialDetail: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginBottom: width * 0.01,
  },
  productPerformanceCard: {
    backgroundColor: c.surface,
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
    borderBottomColor: c.surfaceSunken,
  },
  productRank: {
    width: width * 0.08,
    height: width * 0.08,
    borderRadius: width * 0.04,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: width * 0.03,
  },
  rankNumber: {
    color: c.textInverse,
    fontSize: fontSize.sm,
    fontWeight: 'bold',
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: c.text,
  },
  productBrand: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  productStats: {
    alignItems: 'flex-end',
  },
  productValue: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: c.success,
  },
  productQty: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  customerInsights: {
    backgroundColor: c.surface,
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
    borderBottomColor: c.surfaceSunken,
  },
  insightLabel: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  insightValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
  },
  lowStockCard: {
    backgroundColor: c.surface,
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
    borderBottomColor: c.surfaceSunken,
  },
  lowStockName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: c.text,
  },
  lowStockBrand: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  lowStockQty: {
    alignItems: 'flex-end',
  },
  lowStockLabel: {
    fontSize: fontSize.sm,
    color: c.textSubtle,
  },
  lowStockNumber: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.danger,
  },
  });
};
