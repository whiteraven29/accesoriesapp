import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Plus, Search, CreditCard as Edit, Trash2, Package } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { formatCurrency } from '@/utils/currency';
import { useProducts } from '@/hooks/useProducts';

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
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
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

  const ProductCard = ({ product }: { product: Product }) => {
    const profit = product.sellingPrice - product.buyingPrice;
    const profitMargin = (profit / product.sellingPrice) * 100;
    const isLowStock = product.pieces <= product.lowStockAlert;

    return (
      <View style={[styles.productCard, isLowStock && styles.lowStockCard]}>
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productBrand}>{product.brand} • {product.category}</Text>
          </View>
          <View style={styles.productActions}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleEditProduct(product)}
            >
              <Edit size={16} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleDeleteProduct(product.id)}
            >
              <Trash2 size={16} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.productDetails}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.label}>{t('buyingPrice')}</Text>
              <Text style={styles.buyingPrice}>{formatCurrency(product.buyingPrice)}</Text>
            </View>
            <View>
              <Text style={styles.label}>{t('sellingPrice')}</Text>
              <Text style={styles.sellingPrice}>{formatCurrency(product.sellingPrice)}</Text>
            </View>
            <View>
              <Text style={styles.label}>{t('profit')}</Text>
              <Text style={[styles.profit, { color: profit > 0 ? '#16A34A' : '#DC2626' }]}>
                {formatCurrency(profit)} ({profitMargin.toFixed(1)}%)
              </Text>
            </View>
          </View>
          
          <View style={styles.stockRow}>
            <View>
              <Text style={styles.label}>{t('pieces')}</Text>
              <Text style={[styles.stockValue, isLowStock && styles.lowStockText]}>
                {product.pieces}
              </Text>
            </View>
            <View>
              <Text style={styles.label}>{t('totalValue')}</Text>
              <Text style={styles.totalValue}>
                {formatCurrency(product.sellingPrice * product.pieces)}
              </Text>
            </View>
          </View>
          
          {isLowStock && (
            <Text style={styles.lowStockWarning}>
              ⚠️ {t('lowStockWarning')} ({t('threshold')}: {product.lowStockAlert})
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('products')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
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

      <ScrollView style={styles.productsList} showsVerticalScrollIndicator={false}>
        {filteredProducts.length > 0 ? (
          filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Package size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>{t('noProducts')}</Text>
            <Text style={styles.emptyDescription}>{t('addFirstProduct')}</Text>
          </View>
        )}
      </ScrollView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  },
  addButton: {
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#111827',
  },
  productsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lowStockCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    color: '#6B7280',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  productDetails: {
    gap: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  buyingPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  sellingPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  profit: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  lowStockText: {
    color: '#DC2626',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  lowStockWarning: {
    fontSize: 12,
    color: '#D97706',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
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
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  cancelButton: {
    fontSize: 16,
    color: '#6B7280',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  calculationCard: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  profitValue: {
    fontWeight: '600',
    color: '#16A34A',
  },
  totalCostValue: {
    fontWeight: '600',
    color: '#2563EB',
  },
});