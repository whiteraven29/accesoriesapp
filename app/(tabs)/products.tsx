import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, useWindowDimensions } from 'react-native';
import { Plus, Search, CreditCard as Edit, Trash2, Package, RefreshCw } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  pieces: number;
  lowStockAlert: number;
}

export default function ProductsScreen() {
  const { t, isSwahili } = useLanguage();
  const { products, addProduct, updateProduct, deleteProduct, fetchProducts } = useProducts();
  const { width } = useWindowDimensions();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({
    name: '',
    brand: '',
    category: '',
    buyingPrice: 0,
    sellingPrice: 0,
    pieces: 0,
    lowStockAlert: 5,
  });
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [fetchProducts]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveProduct = () => {
    if (!newProduct.name || !newProduct.brand || !newProduct.category) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, newProduct);
    } else {
      addProduct(newProduct);
    }

    resetForm();
  };

  const resetForm = () => {
    setNewProduct({
      name: '',
      brand: '',
      category: '',
      buyingPrice: 0,
      sellingPrice: 0,
      pieces: 0,
      lowStockAlert: 5,
    });
    setEditingProduct(null);
    setShowAddModal(false);
  };

  const handleEditProduct = (product: Product) => {
    setNewProduct({
      name: product.name,
      brand: product.brand,
      category: product.category,
      buyingPrice: product.buyingPrice,
      sellingPrice: product.sellingPrice,
      pieces: product.pieces,
      lowStockAlert: product.lowStockAlert,
    });
    setEditingProduct(product);
    setShowAddModal(true);
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      t('confirmDelete'),
      t('confirmDeleteProduct'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => deleteProduct(productId) },
      ]
    );
  };

  const calculateTotalValue = () => {
    return products.reduce((total, product) => total + (product.sellingPrice * product.pieces), 0);
  };

  const ProductTable = () => {
    const styles = createStyles(width);

    const isWideScreen = width > 768; // Tablet/desktop breakpoint

    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: isWideScreen ? 3 : 2 }]}>{t('productName')}</Text>
          <Text style={[styles.tableHeaderText, { flex: isWideScreen ? 1.5 : 1 }]}>{t('brand')}</Text>
          <Text style={[styles.tableHeaderText, { flex: isWideScreen ? 1.5 : 1 }]}>{t('category')}</Text>
          <Text style={[styles.tableHeaderText, { flex: isWideScreen ? 1.5 : 1 }]}>{t('buyingPrice')}</Text>
          <Text style={[styles.tableHeaderText, { flex: isWideScreen ? 1.5 : 1 }]}>{t('sellingPrice')}</Text>
          <Text style={[styles.tableHeaderText, { flex: isWideScreen ? 1 : 1 }]}>{t('pieces')}</Text>
          <Text style={[styles.tableHeaderText, { flex: isWideScreen ? 1 : 1 }]}>{t('actions')}</Text>
        </View>
        {filteredProducts.map((product) => {
          const profit = product.sellingPrice - product.buyingPrice;
          const isLowStock = product.pieces <= product.lowStockAlert;

          return (
            <View key={product.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 3 : 2 }]}>{product.name}</Text>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1.5 : 1 }]}>{product.brand}</Text>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1.5 : 1 }]}>{product.category}</Text>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1.5 : 1, color: '#DC2626' }]}>{formatCurrency(product.buyingPrice)}</Text>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1.5 : 1, color: '#16A34A' }]}>{formatCurrency(product.sellingPrice)}</Text>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1 : 1, color: isLowStock ? '#DC2626' : '#111827' }]}>{product.pieces}</Text>
              <View style={{ flex: isWideScreen ? 1 : 1, flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                <TouchableOpacity onPress={() => handleEditProduct(product)}>
                  <Edit size={Math.min(width * 0.04, 16)} color="#6B7280" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteProduct(product.id)}>
                  <Trash2 size={Math.min(width * 0.04, 16)} color="#DC2626" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const styles = createStyles(width);

  return (
    <View style={styles.container}>
      <View style={styles.contentWrapper}>
        <View style={styles.header}>
        <Text style={styles.title}>{t('products')}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.refreshButton, refreshing && styles.refreshingButton]}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Plus size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsBar}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{products.length}</Text>
          <Text style={styles.statLabel}>{t('totalProducts')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatCurrency(calculateTotalValue())}</Text>
          <Text style={styles.statLabel}>{t('totalValue')}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: '#DC2626' }]}>
            {products.filter(p => p.pieces <= p.lowStockAlert).length}
          </Text>
          <Text style={styles.statLabel}>{t('lowStock')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchProducts')}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <ScrollView
        style={styles.productsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredProducts.length > 0 ? (
          <ProductTable />
        ) : (
          <View style={styles.emptyState}>
            <Package size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>{t('noProducts')}</Text>
            <Text style={styles.emptyDescription}>{t('addFirstProduct')}</Text>
          </View>
        )}
      </ScrollView>
     </View>

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingProduct ? t('editProduct') : t('addProduct')}
            </Text>
            <TouchableOpacity onPress={handleSaveProduct}>
              <Text style={styles.saveButton}>{t('save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('productName')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newProduct.name}
                onChangeText={(text) => setNewProduct({...newProduct, name: text})}
                placeholder={t('enterProductName')}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('brand')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newProduct.brand}
                onChangeText={(text) => setNewProduct({...newProduct, brand: text})}
                placeholder={t('enterBrand')}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('category')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newProduct.category}
                onChangeText={(text) => setNewProduct({...newProduct, category: text})}
                placeholder={t('enterCategory')}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>{t('buyingPrice')} (TSH) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProduct.buyingPrice.toString()}
                  onChangeText={(text) => setNewProduct({...newProduct, buyingPrice: Number(text) || 0})}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>{t('sellingPrice')} (TSH) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProduct.sellingPrice.toString()}
                  onChangeText={(text) => setNewProduct({...newProduct, sellingPrice: Number(text) || 0})}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>{t('pieces')} *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProduct.pieces.toString()}
                  onChangeText={(text) => setNewProduct({...newProduct, pieces: Number(text) || 0})}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>{t('lowStockAlert')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProduct.lowStockAlert.toString()}
                  onChangeText={(text) => setNewProduct({...newProduct, lowStockAlert: Number(text) || 5})}
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {newProduct.buyingPrice > 0 && newProduct.sellingPrice > 0 && (
              <View style={styles.calculationCard}>
                <Text style={styles.calculationTitle}>{t('calculations')}</Text>
                <View style={styles.calculationRow}>
                  <Text>{t('profitPerUnit')}:</Text>
                  <Text style={styles.profitValue}>
                    {formatCurrency(newProduct.sellingPrice - newProduct.buyingPrice)}
                  </Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text>{t('profitMargin')}:</Text>
                  <Text style={styles.profitValue}>
                    {(((newProduct.sellingPrice - newProduct.buyingPrice) / newProduct.sellingPrice) * 100).toFixed(1)}%
                  </Text>
                </View>
                {newProduct.pieces > 0 && (
                  <View style={styles.calculationRow}>
                    <Text>{t('totalCost')}:</Text>
                    <Text style={styles.totalCostValue}>
                      {formatCurrency(newProduct.buyingPrice * newProduct.pieces)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (width: number) => StyleSheet.create({
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: width * 0.03,
    paddingTop: width * 0.12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#111827',
  },
  addButton: {
    backgroundColor: '#2563EB',
    width: width * 0.1,
    height: width * 0.1,
    borderRadius: width * 0.05,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  refreshButton: {
    backgroundColor: '#16A34A',
    width: width * 0.1,
    height: width * 0.1,
    borderRadius: width * 0.05,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshingButton: {
    opacity: 0.6,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: width * 0.03,
    paddingHorizontal: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: width * 0.03,
    color: '#6B7280',
    marginTop: width * 0.005,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: width * 0.03,
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.025,
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.025,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: width * 0.02,
    fontSize: width * 0.04,
    color: '#111827',
  },
  productsList: {
    flex: 1,
    paddingHorizontal: width * 0.03,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.03,
    padding: width * 0.03,
    marginBottom: width * 0.025,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lowStockCard: {
    borderLeftWidth: width * 0.01,
    borderLeftColor: '#DC2626',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: width * 0.025,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.01,
  },
  productBrand: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  productActions: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  actionButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: '#F3F4F6',
  },
  productDetails: {
    gap: width * 0.025,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: width * 0.03,
    color: '#6B7280',
    marginBottom: width * 0.005,
  },
  buyingPrice: {
    fontSize: width * 0.035,
    fontWeight: '600',
    color: '#DC2626',
  },
  sellingPrice: {
    fontSize: width * 0.035,
    fontWeight: '600',
    color: '#16A34A',
  },
  profit: {
    fontSize: width * 0.035,
    fontWeight: '600',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockValue: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
  },
  lowStockText: {
    color: '#DC2626',
  },
  totalValue: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  lowStockWarning: {
    fontSize: width * 0.03,
    color: '#D97706',
    fontStyle: 'italic',
    marginTop: width * 0.01,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: width * 0.12,
  },
  emptyTitle: {
    fontSize: width * 0.045,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: width * 0.03,
    marginBottom: width * 0.02,
  },
  emptyDescription: {
    fontSize: width * 0.035,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: width * 0.03,
    paddingTop: width * 0.12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
  },
  cancelButton: {
    fontSize: width * 0.04,
    color: '#6B7280',
  },
  saveButton: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalContent: {
    flex: 1,
    padding: width * 0.03,
  },
  inputGroup: {
    marginBottom: width * 0.03,
  },
  inputLabel: {
    fontSize: width * 0.035,
    fontWeight: '600',
    color: '#374151',
    marginBottom: width * 0.02,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: width * 0.04,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  calculationCard: {
    backgroundColor: '#F3F4F6',
    padding: width * 0.03,
    borderRadius: width * 0.025,
    marginTop: width * 0.03,
  },
  calculationTitle: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.025,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: width * 0.02,
  },
  profitValue: {
    fontWeight: '600',
    color: '#16A34A',
  },
  totalCostValue: {
    fontWeight: '600',
    color: '#2563EB',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.03,
    marginHorizontal: width * 0.03,
    marginBottom: width * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: width * 0.025,
    paddingHorizontal: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    fontSize: width * 0.035,
    fontWeight: 'bold',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: width * 0.025,
    paddingHorizontal: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCell: {
    fontSize: width * 0.035,
    color: '#111827',
  },
});