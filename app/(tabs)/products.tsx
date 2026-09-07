import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, useWindowDimensions } from 'react-native';
import { Plus, Search, CreditCard as Edit, ScanLine, Trash2, Package, RefreshCw } from 'lucide-react-native';
import { ImeiManager } from '../../components/ImeiManager';
import { createProductUnit, isValidImei } from '../../hooks/useProductUnits';
import { BREAKPOINTS } from '../../constants/layout';
import { Palette, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { Product, useProducts } from '../../hooks/useProducts';
import { grossMarginPercentage, grossProfit, roundMoney } from '../../utils/calculations';

export default function ProductsScreen() {
  const { t, isSwahili } = useLanguage();
  const { colors: c } = useTheme();
  const { products, addProduct, updateProduct, deleteProduct, fetchProducts } = useProducts();
  const { width } = useWindowDimensions();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [unitProduct, setUnitProduct] = useState<{ id: string; name: string; cost: number } | null>(null);
  // IMEIs collected while creating a phone, before there is a product to attach
  // them to. Written as units immediately after the product row is inserted.
  const [pendingImeis, setPendingImeis] = useState<string[]>([]);
  const [imeiDraft, setImeiDraft] = useState('');
  // The editable form shape: identity, timestamps and the serialisation flag
  // are owned by the database, not typed into this form.
  type NewProduct = Omit<
    Product,
    'id' | 'created_at' | 'isSerialized' | 'warrantyDays' | 'supplierId' | 'imei'
  > & { imei?: string };

  const [newProduct, setNewProduct] = useState<NewProduct>({
    name: '',
    brand: '',
    category: '',
    buyingPrice: 0,
    sellingPrice: 0,
    pieces: 0,
    lowStockAlert: 5,
    imei: undefined,
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

  const addImeiToDraft = () => {
    const imei = imeiDraft.trim();
    if (!isValidImei(imei)) {
      Alert.alert(t('error'), t('imeiInvalid'));
      return;
    }
    if (pendingImeis.includes(imei)) {
      Alert.alert(t('error'), t('imeiAlreadyExists'));
      return;
    }
    setPendingImeis(prev => [...prev, imei]);
    setImeiDraft('');
  };

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.brand || !newProduct.category) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    // Only a brand-new phone starts serialised, when its count is zero and
    // there is nothing to lose. Editing an existing product never flips the
    // flag: that would leave it claiming its old piece count with no IMEIs
    // behind it. Converting stock you already hold is deliberate — register an
    // IMEI for every unit, then convert from the IMEI list.
    const serialized = !editingProduct && newProduct.category === 'Phones';

    if (
      newProduct.buyingPrice < 0 ||
      newProduct.sellingPrice < 0 ||
      !Number.isInteger(newProduct.pieces) ||
      newProduct.pieces < 0 ||
      !Number.isInteger(newProduct.lowStockAlert) ||
      newProduct.lowStockAlert < 0
    ) {
      Alert.alert(t('error'), 'Prices and stock values must be valid non-negative numbers.');
      return;
    }

    if (serialized && pendingImeis.length === 0) {
      Alert.alert(t('error'), t('unitsRequired'));
      return;
    }

    const { product: saved, error } = editingProduct
      ? // `isSerialized` is intentionally absent: the existing value stands.
        await updateProduct(editingProduct.id, newProduct)
      : await addProduct({
          ...newProduct,
          isSerialized: serialized,
          warrantyDays: serialized ? 365 : 0,
        });

    if (!saved) {
      Alert.alert(t('error'), error ?? 'Product could not be saved.');
      return;
    }

    // Register the staged handsets. A failure here is reported per IMEI so the
    // shopkeeper knows exactly which one to re-enter.
    if (serialized && pendingImeis.length > 0) {
      const failed: string[] = [];
      for (const imei of pendingImeis) {
        const { unit, error: unitError } = await createProductUnit({
          productId: saved.id,
          imei,
          cost: saved.buyingPrice,
        });
        if (!unit) failed.push(`${imei}${unitError === 'imeiAlreadyExists' ? ` (${t('imeiAlreadyExists')})` : ''}`);
      }
      if (failed.length > 0) Alert.alert(t('error'), failed.join('\n'));
      await fetchProducts();
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
    setPendingImeis([]);
    setImeiDraft('');
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
      imei: product.imei, // Include IMEI
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

  const styles = useMemo(() => createStyles(width, c), [width, c]);

  /**
   * True when the piece count is maintained by the database from registered
   * IMEIs — either an existing serialised product, or a new phone being created.
   * Existing phones still on a plain count stay editable until converted.
   */
  const stockIsDerived = editingProduct
    ? editingProduct.isSerialized
    : newProduct.category === 'Phones';

  // Rendered as an element rather than a nested component: declaring a
  // component inside the render body gives React a new type on every
  // render, which unmounts and remounts the whole subtree.
  const productTable = (() => {
    const isWideScreen = width > BREAKPOINTS.md; // Tablet/desktop

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
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1.5 : 1, color: c.danger }]}>{formatCurrency(product.buyingPrice)}</Text>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1.5 : 1, color: c.success }]}>{formatCurrency(product.sellingPrice)}</Text>
              <Text style={[styles.tableCell, { flex: isWideScreen ? 1 : 1, color: isLowStock ? c.danger : c.text }]}>{product.pieces}</Text>
              <View style={{ flex: isWideScreen ? 1 : 1, flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
                {/* Serialised products are restocked by registering IMEIs, so
                    they get a dedicated entry point into the unit list. */}
                {(product.isSerialized || product.category === 'Phones') ? (
                  <TouchableOpacity
                    onPress={() => setUnitProduct({ id: product.id, name: product.name, cost: product.buyingPrice })}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('serialNumbers')}: ${product.name}`}
                    hitSlop={8}
                  >
                    <ScanLine size={15} color={c.info} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  onPress={() => handleEditProduct(product)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('edit')}: ${product.name}`}
                  hitSlop={8}
                >
                  <Edit size={15} color={c.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteProduct(product.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('delete')}: ${product.name}`}
                  hitSlop={8}
                >
                  <Trash2 size={15} color={c.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    );
  })();



  function handleCategoryChange(category: string): void {
    setNewProduct(prev => ({
      ...prev,
      category,
      // Clear IMEI if switching away from Phones
      ...(category !== 'Phones' ? { imei: undefined } : {})
    }));
  }
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
            <RefreshCw size={18} color={c.textInverse} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
            <Plus size={18} color={c.textInverse} />
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
          <Text style={[styles.statValue, { color: c.danger }]}>
            {products.filter(p => p.pieces <= p.lowStockAlert).length}
          </Text>
          <Text style={styles.statLabel}>{t('lowStock')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={c.textSubtle} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchProducts')}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={c.textSubtle}
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
          <ScrollView
            horizontal
            style={styles.tableScroll}
            contentContainerStyle={styles.tableScrollContent}
            showsHorizontalScrollIndicator={width < 768}
          >
            {productTable}
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Package size={48} color={c.textSubtle} />
            <Text style={styles.emptyTitle}>{t('noProducts')}</Text>
            <Text style={styles.emptyDescription}>{t('addFirstProduct')}</Text>
          </View>
        )}
      </ScrollView>
     </View>

      <Modal visible={showAddModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
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
                onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
                placeholder={t('enterProductName')}
                placeholderTextColor={c.textSubtle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('brand')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newProduct.brand}
                onChangeText={(text) => setNewProduct({ ...newProduct, brand: text })}
                placeholder={t('enterBrand')}
                placeholderTextColor={c.textSubtle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('category')} *</Text>
              <View style={styles.categoryButtons}>
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newProduct.category === 'Accessories' && styles.selectedCategoryButton,
                  ]}
                  onPress={() => handleCategoryChange('Accessories')}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      newProduct.category === 'Accessories' && styles.selectedCategoryButtonText,
                    ]}
                  >
                    {t('accessories')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.categoryButton,
                    newProduct.category === 'Phones' && styles.selectedCategoryButton,
                  ]}
                  onPress={() => handleCategoryChange('Phones')}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      newProduct.category === 'Phones' && styles.selectedCategoryButtonText,
                    ]}
                  >
                    {t('phones')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Handsets no longer take a single IMEI on the product row: each
                unit is registered separately so five phones are five IMEIs. */}
            {/* Handsets are registered by IMEI. Each one entered here becomes a
                unit, and the piece count below follows the list. */}
            {stockIsDerived && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('serialNumbers')} *</Text>

                {editingProduct ? (
                  <TouchableOpacity
                    style={styles.serializedNotice}
                    onPress={() => setUnitProduct({
                      id: editingProduct.id,
                      name: editingProduct.name,
                      cost: editingProduct.buyingPrice,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={t('imeiList')}
                  >
                    <ScanLine size={16} color={c.info} />
                    <Text style={styles.serializedNoticeText}>{t('imeiList')}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.imeiEntryRow}>
                      <TextInput
                        style={[styles.textInput, styles.imeiEntryInput]}
                        value={imeiDraft}
                        onChangeText={text => setImeiDraft(text.replace(/[^0-9]/g, '').slice(0, 15))}
                        placeholder={t('enterIMEI')}
                        keyboardType="numeric"
                        placeholderTextColor={c.textSubtle}
                        accessibilityLabel={t('addImei')}
                        onSubmitEditing={addImeiToDraft}
                        returnKeyType="done"
                      />
                      <TouchableOpacity
                        style={styles.imeiAddButton}
                        onPress={addImeiToDraft}
                        accessibilityRole="button"
                        accessibilityLabel={t('addImei')}
                      >
                        <Plus size={18} color={c.textInverse} />
                      </TouchableOpacity>
                    </View>

                    {pendingImeis.map(imei => (
                      <View key={imei} style={styles.imeiChip}>
                        <Text style={styles.imeiChipText} selectable>{imei}</Text>
                        <TouchableOpacity
                          onPress={() => setPendingImeis(prev => prev.filter(v => v !== imei))}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('delete')} ${imei}`}
                          hitSlop={8}
                        >
                          <Trash2 size={15} color={c.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <Text style={styles.helperText}>{t('unitsRequired')}</Text>
                  </>
                )}
              </View>
            )}

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>{t('buyingPrice')} (TSH) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProduct.buyingPrice.toString()}
                  onChangeText={(text) =>
                    setNewProduct({ ...newProduct, buyingPrice: roundMoney(Number(text.replace(/[^0-9]/g, ''))) })
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={c.textSubtle}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>{t('sellingPrice')} (TSH) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProduct.sellingPrice.toString()}
                  onChangeText={(text) =>
                    setNewProduct({ ...newProduct, sellingPrice: roundMoney(Number(text.replace(/[^0-9]/g, ''))) })
                  }
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={c.textSubtle}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.inputLabel}>{t('pieces')} *</Text>
                <TextInput
                  style={[styles.textInput, stockIsDerived && styles.textInputDisabled]}
                  // For handsets this mirrors the IMEI list rather than being
                  // typed: the count and the registered units cannot disagree.
                  value={stockIsDerived
                    ? String(editingProduct ? editingProduct.pieces : pendingImeis.length)
                    : newProduct.pieces.toString()}
                  onChangeText={(text) =>
                    setNewProduct({ ...newProduct, pieces: Math.max(0, Math.trunc(Number(text.replace(/[^0-9]/g, '')) || 0)) })
                  }
                  // Serialised stock is the count of registered IMEIs, kept by a
                  // database trigger, so typing a number here would be a lie.
                  editable={!stockIsDerived}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={c.textSubtle}
                  accessibilityLabel={t('pieces')}
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.inputLabel}>{t('lowStockAlert')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={newProduct.lowStockAlert.toString()}
                  onChangeText={(text) =>
                    setNewProduct({ ...newProduct, lowStockAlert: Math.max(0, Math.trunc(Number(text.replace(/[^0-9]/g, '')) || 0)) })
                  }
                  placeholder="5"
                  keyboardType="numeric"
                  placeholderTextColor={c.textSubtle}
                />
              </View>
            </View>

            {newProduct.buyingPrice > 0 && newProduct.sellingPrice > 0 && (
              <View style={styles.calculationCard}>
                <Text style={styles.calculationTitle}>{t('calculations')}</Text>
                <View style={styles.calculationRow}>
                  <Text>{t('profitPerUnit')}:</Text>
                  <Text style={styles.profitValue}>
                    {formatCurrency(grossProfit(newProduct.sellingPrice, newProduct.buyingPrice))}
                  </Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text>{t('profitMargin')}:</Text>
                  <Text style={styles.profitValue}>
                    {grossMarginPercentage(newProduct.sellingPrice, newProduct.buyingPrice).toFixed(1)}%
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
        </View>
      </Modal>

      {unitProduct ? (
        <ImeiManager
          visible
          onClose={() => setUnitProduct(null)}
          productId={unitProduct.id}
          productName={unitProduct.name}
          defaultCost={unitProduct.cost}
        />
      ) : null}
    </View>
  );
}

const createStyles = (viewportWidth: number, c: Palette) => {
  const width = Math.min(Math.max(viewportWidth, 320), 480);
  return StyleSheet.create({
  imeiEntryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imeiEntryInput: {
    flex: 1,
    marginBottom: 0,
  },
  imeiAddButton: {
    backgroundColor: c.primary,
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imeiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  imeiChipText: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  helperText: {
    marginTop: 8,
    color: c.textSubtle,
    fontSize: 12,
  },
  serializedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.infoTint,
    borderRadius: 10,
    padding: 12,
  },
  serializedNoticeText: {
    flex: 1,
    color: '#5B21B6',
    fontSize: 13,
    fontWeight: '600',
  },
  textInputDisabled: {
    backgroundColor: c.surfaceSunken,
    color: c.textSubtle,
  },
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  contentWrapper: {
    flex: 1,
    maxWidth: Math.min(viewportWidth, 1200), // Max width for large screens
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: width * 0.03,
    paddingTop: width * 0.03,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: c.text,
  },
  addButton: {
    backgroundColor: c.primary,
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
    backgroundColor: c.success,
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
    backgroundColor: c.surface,
    paddingVertical: width * 0.03,
    paddingHorizontal: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginTop: width * 0.005,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: width * 0.03,
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.025,
    backgroundColor: c.surface,
    borderRadius: width * 0.025,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: width * 0.02,
    fontSize: fontSize.md,
    color: c.text,
  },
  productsList: {
    flex: 1,
    paddingHorizontal: width * 0.03,
  },
  tableScroll: {
    width: '100%',
  },
  tableScrollContent: {
    flexGrow: 1,
    paddingBottom: width * 0.03,
  },
  productCard: {
    backgroundColor: c.surface,
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
    borderLeftColor: c.danger,
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
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.01,
  },
  productBrand: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  productActions: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  actionButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: c.surfaceSunken,
  },
  productDetails: {
    gap: width * 0.025,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginBottom: width * 0.005,
  },
  buyingPrice: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: c.danger,
  },
  sellingPrice: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: c.success,
  },
  profit: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
  },
  lowStockText: {
    color: c.danger,
  },
  totalValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.primary,
  },
  lowStockWarning: {
    fontSize: fontSize.sm,
    color: c.warning,
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
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: c.textMuted,
    marginTop: width * 0.03,
    marginBottom: width * 0.02,
  },
  emptyDescription: {
    fontSize: fontSize.sm,
    color: c.textSubtle,
    textAlign: 'center',
  },
  modalContainer: {
    width: '92%',
    maxWidth: 760,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: c.surface,
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: width * 0.03,
    paddingTop: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
  },
  cancelButton: {
    fontSize: fontSize.md,
    color: c.textMuted,
  },
  saveButton: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.primary,
  },
  modalContent: {
    flex: 1,
    padding: width * 0.03,
  },
  inputGroup: {
    marginBottom: width * 0.03,
  },
  inputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: c.textMuted,
    marginBottom: width * 0.02,
  },
  textInput: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  calculationCard: {
    backgroundColor: c.surfaceSunken,
    padding: width * 0.03,
    borderRadius: width * 0.025,
    marginTop: width * 0.03,
  },
  calculationTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.025,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: width * 0.02,
  },
  profitValue: {
    fontWeight: '600',
    color: c.success,
  },
  totalCostValue: {
    fontWeight: '600',
    color: c.primary,
  },
  tableContainer: {
    minWidth: viewportWidth < 768 ? 860 : '100%',
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: width * 0.03,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: c.surfaceSunken,
    paddingVertical: width * 0.025,
    paddingHorizontal: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  tableHeaderText: {
    fontSize: fontSize.sm,
    fontWeight: 'bold',
    color: c.textMuted,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: width * 0.025,
    paddingHorizontal: width * 0.03,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceSunken,
  },
  tableCell: {
    fontSize: fontSize.sm,
    color: c.text,
    paddingHorizontal: 6,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  categoryButton: {
    flex: 1,
    padding: width * 0.03,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    alignItems: 'center',
    backgroundColor: c.surface,
  },
  selectedCategoryButton: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  categoryButtonText: {
    fontSize: fontSize.md,
    color: c.text,
  },
  selectedCategoryButtonText: {
    color: c.textInverse,
  },
  });
};
