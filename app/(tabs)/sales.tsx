import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, useWindowDimensions } from 'react-native';
import { ShoppingCart, Plus, Minus, Trash2, Calculator, Users, CreditCard } from 'lucide-react-native';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { useCustomers } from '../../hooks/useCustomers';

interface CartItem {
  productId: string;
  quantity: number;
  useLoanPrice?: boolean;
  loanDiscount?: number;
}

export default function SalesScreen() {
  const { t } = useLanguage();
  const { products, updateProductStock, fetchProducts } = useProducts();
  const { addSale, fetchSales } = useSales();
  const { customers, addLoan } = useCustomers();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [currentLoanItem, setCurrentLoanItem] = useState<CartItem | null>(null);
  const [loanDiscount, setLoanDiscount] = useState<number>(0);
  const { width } = useWindowDimensions();
  const styles = createStyles(width);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh both products and sales data
    await Promise.all([
      fetchProducts(),
      fetchSales()
    ]);
    setRefreshing(false);
  }, [fetchProducts, fetchSales]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.pieces <= 0) {
      Alert.alert(t('error'), 'Product out of stock');
      return;
    }

    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
      if (existingItem.quantity >= product.pieces) {
        Alert.alert(t('error'), 'Not enough stock available');
        return;
      }
      setCart(prev => prev.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart(prev => [...prev, { productId, quantity: 1 }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.productId === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter(item => item.productId !== productId);
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return total;

      const basePrice = product.sellingPrice;
      const finalPrice = item.useLoanPrice && item.loanDiscount
        ? basePrice - (basePrice * item.loanDiscount / 100)
        : basePrice;

      return total + (finalPrice * item.quantity);
    }, 0);
  };

  const selectCustomer = (customerId: string | null) => {
    setSelectedCustomer(customerId);
    setShowCustomerModal(false);
  };

  const applyLoanPricing = (productId: string) => {
    const cartItem = cart.find(item => item.productId === productId);
    if (cartItem) {
      setCurrentLoanItem(cartItem);
      setShowLoanModal(true);
    }
  };

  const confirmLoanPricing = () => {
    if (currentLoanItem && loanDiscount > 0 && loanDiscount <= 100) {
      setCart(prev => prev.map(item =>
        item.productId === currentLoanItem.productId
          ? { ...item, useLoanPrice: true, loanDiscount }
          : item
      ));
      setShowLoanModal(false);
      setCurrentLoanItem(null);
      setLoanDiscount(0);
    } else {
      Alert.alert(t('error'), 'Please enter a valid discount percentage (1-100%)');
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert(t('error'), 'Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  const completeSale = async () => {
    const total = getCartTotal();
    if (cashReceived < total) {
      Alert.alert(t('error'), 'Insufficient cash received');
      return;
    }

    // Calculate loan amounts and create loan records if customer is selected
    if (selectedCustomer) {
      const loanItems = cart.filter(item => item.useLoanPrice && item.loanDiscount);
      if (loanItems.length > 0) {
        let totalLoanAmount = 0;

        for (const item of loanItems) {
          const product = products.find(p => p.id === item.productId);
          if (product && item.loanDiscount) {
            const originalPrice = product.sellingPrice * item.quantity;
            const discountedPrice = originalPrice - (originalPrice * item.loanDiscount / 100);
            const loanAmount = originalPrice - discountedPrice;
            totalLoanAmount += loanAmount;
          }
        }

        if (totalLoanAmount > 0) {
          await addLoan(selectedCustomer, totalLoanAmount, `Loan for sale items`);
        }
      }
    }

    // Update product stock
    cart.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        updateProductStock(item.productId, product.pieces - item.quantity);
      }
    });

    // Add sale record with correct pricing
    addSale(
      {
        total,
        cashReceived,
        change: cashReceived - total,
      },
      cart.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return { productId: item.productId, quantity: item.quantity, price: 0 };

        const basePrice = product.sellingPrice;
        const finalPrice = item.useLoanPrice && item.loanDiscount
          ? basePrice - (basePrice * item.loanDiscount / 100)
          : basePrice;

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: finalPrice,
        };
      })
    );

    // Reset
    setCart([]);
    setCashReceived(0);
    setShowCheckout(false);
    setSelectedCustomer(null);

    Alert.alert(t('success'), 'Sale completed successfully!');
  };

  const ProductTable = () => {
    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, { flex: 3 }]}>{t('productName')}</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>{t('brand')}</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>{t('price')}</Text>
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>{t('stock')}</Text>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>{t('actions')}</Text>
        </View>
        {filteredProducts.map((product) => {
          const cartItem = cart.find(item => item.productId === product.id);
          const quantityInCart = cartItem?.quantity || 0;
          const availableStock = product.pieces - quantityInCart;
          
          return (
            <View key={product.id} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 3 }]}>{product.name}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{product.brand}</Text>
              <Text style={[styles.tableCell, { flex: 1, color: '#2563EB' }]}>{formatCurrency(product.sellingPrice)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{product.pieces}</Text>
              <View style={{ flex: 2, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {quantityInCart > 0 ? (
                  <>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => removeFromCart(product.id)}
                    >
                      <Minus size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantityInCart}</Text>
                    <TouchableOpacity
                      style={[styles.quantityButton, availableStock === 0 && styles.disabledButton]}
                      onPress={() => addToCart(product.id)}
                      disabled={availableStock === 0}
                    >
                      <Plus size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.addButton, product.pieces === 0 && styles.disabledButton]}
                    onPress={() => addToCart(product.id)}
                    disabled={product.pieces === 0}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>{t('addToCart')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const CartSummary = () => {
    if (cart.length === 0) return null;

    return (
      <View style={styles.cartSummary}>
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>{t('cart')} ({cart.length})</Text>
          <TouchableOpacity onPress={clearCart}>
            <Trash2 size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>
        
        {cart.map(item => {
          const product = products.find(p => p.id === item.productId);
          if (!product) return null;

          const basePrice = product.sellingPrice;
          const finalPrice = item.useLoanPrice && item.loanDiscount
            ? basePrice - (basePrice * item.loanDiscount / 100)
            : basePrice;
          const totalItemPrice = finalPrice * item.quantity;

          return (
            <View key={item.productId} style={styles.cartItem}>
              <View style={styles.cartItemHeader}>
                <Text style={styles.cartItemName}>{product.name}</Text>
                {selectedCustomer && (
                  <TouchableOpacity
                    style={styles.loanButton}
                    onPress={() => applyLoanPricing(item.productId)}
                  >
                    <CreditCard size={16} color="#FFFFFF" />
                    <Text style={styles.loanButtonText}>Loan</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.cartItemDetails}>
                {item.quantity} x {formatCurrency(finalPrice)} = {formatCurrency(totalItemPrice)}
              </Text>
              {item.useLoanPrice && item.loanDiscount && (
                <Text style={styles.loanDiscountText}>
                  Loan discount: {item.loanDiscount}% off original price {formatCurrency(basePrice)}
                </Text>
              )}
            </View>
          );
        })}
        
        <View style={styles.cartTotal}>
          <Text style={styles.cartTotalText}>{t('total')}: {formatCurrency(getCartTotal())}</Text>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Calculator size={16} color="#FFFFFF" />
            <Text style={styles.checkoutButtonText}>{t('checkout')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const selectedCustomerData = customers.find(c => c.id === selectedCustomer);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('pointOfSale')}</Text>
      </View>

      {/* Customer Selection */}
      <View style={styles.customerSection}>
        <TouchableOpacity
          style={styles.customerButton}
          onPress={() => setShowCustomerModal(true)}
        >
          <Users size={20} color="#FFFFFF" />
          <Text style={styles.customerButtonText}>
            {selectedCustomerData ? selectedCustomerData.name : t('selectCustomer')}
          </Text>
        </TouchableOpacity>
        {selectedCustomerData && (
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{selectedCustomerData.name}</Text>
            <Text style={styles.customerBalance}>
              Loan Balance: {formatCurrency(selectedCustomerData.loanBalance)}
            </Text>
          </View>
        )}
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder={t('searchProducts')}
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholderTextColor="#9CA3AF"
      />

      <ScrollView
        style={styles.productsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ProductTable />
      </ScrollView>

      <CartSummary />

      <Modal visible={showCheckout} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCheckout(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('checkout')}</Text>
            <TouchableOpacity onPress={completeSale}>
              <Text style={styles.saveButton}>{t('completeSale')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.checkoutSummary}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              {cart.map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return null;
                
                return (
                  <View key={item.productId} style={styles.checkoutItem}>
                    <Text style={styles.checkoutItemName}>{product.name}</Text>
                    <Text style={styles.checkoutItemPrice}>
                      {item.quantity} x {formatCurrency(product.sellingPrice)} = {formatCurrency(product.sellingPrice * item.quantity)}
                    </Text>
                  </View>
                );
              })}
              
              <View style={styles.checkoutTotal}>
                <Text style={styles.checkoutTotalText}>
                  {t('total')}: {formatCurrency(getCartTotal())}
                </Text>
              </View>
            </View>

            <View style={styles.paymentSection}>
              <Text style={styles.sectionTitle}>Payment</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('cash')} (TSH)</Text>
                <TextInput
                  style={styles.textInput}
                  value={cashReceived.toString()}
                  onChangeText={(text) => setCashReceived(Number(text) || 0)}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              
              {cashReceived > 0 && (
                <View style={styles.changeInfo}>
                  <Text style={styles.changeLabel}>{t('change')}:</Text>
                  <Text style={[styles.changeAmount, { 
                    color: cashReceived >= getCartTotal() ? '#16A34A' : '#DC2626' 
                  }]}>
                    {formatCurrency(Math.max(0, cashReceived - getCartTotal()))}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Customer Selection Modal */}
      <Modal visible={showCustomerModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
              <Text style={styles.saveButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <TouchableOpacity
              style={[styles.customerOption, !selectedCustomer && styles.selectedCustomer]}
              onPress={() => selectCustomer(null)}
            >
              <Text style={[styles.customerOptionText, !selectedCustomer && styles.selectedCustomerText]}>
                No Customer (Cash Sale)
              </Text>
            </TouchableOpacity>

            {customers.map(customer => (
              <TouchableOpacity
                key={customer.id}
                style={[styles.customerOption, selectedCustomer === customer.id && styles.selectedCustomer]}
                onPress={() => selectCustomer(customer.id)}
              >
                <View>
                  <Text style={[styles.customerOptionText, selectedCustomer === customer.id && styles.selectedCustomerText]}>
                    {customer.name}
                  </Text>
                  <Text style={styles.customerOptionDetails}>
                    Phone: {customer.phone} | Balance: {formatCurrency(customer.loanBalance)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Loan Pricing Modal */}
      <Modal visible={showLoanModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLoanModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Apply Loan Discount</Text>
            <TouchableOpacity onPress={confirmLoanPricing}>
              <Text style={styles.saveButton}>Apply</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {currentLoanItem && (
              <View>
                <Text style={styles.loanProductName}>
                  {products.find(p => p.id === currentLoanItem.productId)?.name}
                </Text>
                <Text style={styles.loanProductPrice}>
                  Original Price: {formatCurrency(products.find(p => p.id === currentLoanItem.productId)?.sellingPrice || 0)}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Discount Percentage (%)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={loanDiscount.toString()}
                    onChangeText={(text) => setLoanDiscount(Number(text) || 0)}
                    placeholder="Enter discount % (e.g., 10)"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {loanDiscount > 0 && loanDiscount <= 100 && (
                  <View style={styles.loanCalculation}>
                    <Text style={styles.loanCalculationText}>
                      Discounted Price: {formatCurrency(
                        (products.find(p => p.id === currentLoanItem.productId)?.sellingPrice || 0) *
                        (1 - loanDiscount / 100)
                      )}
                    </Text>
                    <Text style={styles.loanCalculationText}>
                      Loan Amount: {formatCurrency(
                        (products.find(p => p.id === currentLoanItem.productId)?.sellingPrice || 0) *
                        (loanDiscount / 100) * currentLoanItem.quantity
                      )}
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
  header: {
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
    textAlign: 'center',
  },
  customerSection: {
    margin: width * 0.03,
    marginTop: 0,
  },
  customerButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.02,
  },
  customerButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.04,
    fontWeight: '600',
  },
  customerInfo: {
    marginTop: width * 0.02,
    padding: width * 0.03,
    backgroundColor: '#F3F4F6',
    borderRadius: width * 0.025,
  },
  customerName: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerBalance: {
    fontSize: width * 0.035,
    color: '#6B7280',
    marginTop: width * 0.01,
  },
  searchInput: {
    margin: width * 0.03,
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.025,
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.025,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.005,
  },
  productBrand: {
    fontSize: width * 0.035,
    color: '#6B7280',
    marginBottom: width * 0.01,
  },
  productPrice: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: width * 0.005,
  },
  stockInfo: {
    fontSize: width * 0.03,
    color: '#9CA3AF',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: width * 0.025,
  },
  quantityButton: {
    backgroundColor: '#2563EB',
    width: width * 0.08,
    height: width * 0.08,
    borderRadius: width * 0.04,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  quantityText: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
    minWidth: width * 0.06,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.01,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.035,
    fontWeight: '600',
  },
  cartSummary: {
    backgroundColor: '#FFFFFF',
    margin: width * 0.03,
    padding: width * 0.03,
    borderRadius: width * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.025,
  },
  cartTitle: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
  },
  cartItem: {
    marginBottom: width * 0.02,
  },
  cartItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.01,
  },
  cartItemName: {
    fontSize: width * 0.035,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  loanButton: {
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.02,
    paddingVertical: width * 0.01,
    borderRadius: width * 0.015,
    gap: width * 0.01,
  },
  loanButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.03,
    fontWeight: '600',
  },
  loanDiscountText: {
    fontSize: width * 0.03,
    color: '#7C3AED',
    fontStyle: 'italic',
    marginTop: width * 0.005,
  },
  cartItemDetails: {
    fontSize: width * 0.03,
    color: '#6B7280',
  },
  cartTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: width * 0.025,
    marginTop: width * 0.02,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartTotalText: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#111827',
  },
  checkoutButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.01,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.035,
    fontWeight: '600',
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
  checkoutSummary: {
    marginBottom: width * 0.05,
  },
  sectionTitle: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.03,
  },
  checkoutItem: {
    marginBottom: width * 0.025,
  },
  checkoutItemName: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#111827',
  },
  checkoutItemPrice: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  checkoutTotal: {
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    paddingTop: width * 0.025,
    marginTop: width * 0.025,
  },
  checkoutTotalText: {
    fontSize: width * 0.05,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
  paymentSection: {
    marginBottom: width * 0.05,
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
  changeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: width * 0.03,
    borderRadius: width * 0.025,
  },
  changeLabel: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#374151',
  },
  changeAmount: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
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
  customerOption: {
    padding: width * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectedCustomer: {
    backgroundColor: '#EBF4FF',
  },
  customerOptionText: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#111827',
  },
  selectedCustomerText: {
    color: '#2563EB',
  },
  customerOptionDetails: {
    fontSize: width * 0.035,
    color: '#6B7280',
    marginTop: width * 0.01,
  },
  loanProductName: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.02,
  },
  loanProductPrice: {
    fontSize: width * 0.04,
    color: '#6B7280',
    marginBottom: width * 0.03,
  },
  loanCalculation: {
    backgroundColor: '#F3F4F6',
    padding: width * 0.03,
    borderRadius: width * 0.025,
    marginTop: width * 0.03,
  },
  loanCalculationText: {
    fontSize: width * 0.04,
    color: '#111827',
    marginBottom: width * 0.01,
  },
});