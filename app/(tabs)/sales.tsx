import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, useWindowDimensions } from 'react-native';
import { ShoppingCart, Plus, Minus, Trash2, Calculator, Users, CreditCard, RefreshCw, Download } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';
import { useSales, Sale } from '../../hooks/useSales';
import { useCustomers } from '../../hooks/useCustomers';
import { supabase } from '../../utils/supabase';

interface CartItem {
  productId: string;
  quantity: number;
  discount?: number; // Percentage discount (0-100)
  useLoan?: boolean; // Whether to use loan for this item
}

interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  pieces: number;
  lowStockAlert?: number;
  imei?: string;
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
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [receiptSignature, setReceiptSignature] = useState('');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [userProfile, setUserProfile] = useState<{username: string, shop_name: string} | null>(null);
  const [currentItem, setCurrentItem] = useState<CartItem | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
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
      const discountedPrice = item.discount
        ? basePrice - (basePrice * item.discount / 100)
        : basePrice;

      return total + (discountedPrice * item.quantity);
    }, 0);
  };

  const selectCustomer = (customerId: string | null) => {
    setSelectedCustomer(customerId);
    setShowCustomerModal(false);
  };

  const applyLoan = (productId: string) => {
    setCart(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, useLoan: !item.useLoan }
        : item
    ));
  };

  const applyDiscount = (productId: string) => {
    const cartItem = cart.find(item => item.productId === productId);
    if (cartItem) {
      setCurrentItem(cartItem);
      setShowDiscountModal(true);
    }
  };

  const confirmDiscount = () => {
    if (currentItem && discountPercentage >= 0 && discountPercentage <= 100) {
      setCart(prev => prev.map(item =>
        item.productId === currentItem.productId
          ? { ...item, discount: discountPercentage }
          : item
      ));
      setShowDiscountModal(false);
      setCurrentItem(null);
      setDiscountPercentage(0);
    } else {
      Alert.alert(t('error'), 'Please enter a valid discount percentage (0-100%)');
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert(t('error'), 'Cart is empty');
      return;
    }
    // Set cash received to total amount by default
    setCashReceived(getCartTotal());
    setShowCheckout(true);
  };

  const completeSale = async () => {
    const total = getCartTotal();
    if (cashReceived < total) {
      Alert.alert(t('error'), 'Insufficient cash received');
      return;
    }

    // Calculate loan amounts if customer is selected and items are marked for loan
    if (selectedCustomer) {
      const loanItems = cart.filter(item => item.useLoan);
      if (loanItems.length > 0) {
        let totalLoanAmount = 0;

        for (const item of loanItems) {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            const basePrice = product.sellingPrice;
            const discountedPrice = item.discount
              ? basePrice - (basePrice * item.discount / 100)
              : basePrice;
            const itemTotal = discountedPrice * item.quantity;
            totalLoanAmount += itemTotal;
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
    const result = await addSale(
      {
        total,
        cashReceived,
        change: cashReceived - total,
      },
      cart.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return { productId: item.productId, quantity: item.quantity, price: 0, buyingPrice: 0 };

        const basePrice = product.sellingPrice;
        const finalPrice = item.discount
          ? basePrice - (basePrice * item.discount / 100)
          : basePrice;

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: finalPrice,
        };
      })
    );

    // Show receipt
    if (result) {
      setCurrentSale(result);
      await fetchUserProfile();
      setShowReceiptModal(true);
    }

    // Reset
    setCart([]);
    setCashReceived(0);
    setShowCheckout(false);
    setSelectedCustomer(null);
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
           const discountedPrice = item.discount
             ? basePrice - (basePrice * item.discount / 100)
             : basePrice;
           const totalItemPrice = discountedPrice * item.quantity;

           return (
             <View key={item.productId} style={styles.cartItem}>
               <View style={styles.cartItemHeader}>
                 <Text style={styles.cartItemName}>{product.name}</Text>
                 <View style={styles.itemActions}>
                   <TouchableOpacity
                     style={styles.discountButton}
                     onPress={() => applyDiscount(item.productId)}
                   >
                     <Text style={styles.discountButtonText}>%</Text>
                   </TouchableOpacity>
                   {selectedCustomer && (
                     <TouchableOpacity
                       style={[styles.loanButton, item.useLoan && styles.activeLoanButton]}
                       onPress={() => applyLoan(item.productId)}
                     >
                       <CreditCard size={16} color="#FFFFFF" />
                       <Text style={styles.loanButtonText}>Loan</Text>
                     </TouchableOpacity>
                   )}
                 </View>
               </View>
               <Text style={styles.cartItemDetails}>
                 {item.quantity} x {formatCurrency(discountedPrice)} = {formatCurrency(totalItemPrice)}
               </Text>
               {item.discount && (
                 <Text style={styles.discountText}>
                   Discount: {item.discount}% off original price {formatCurrency(basePrice)}
                 </Text>
               )}
               {item.useLoan && (
                 <Text style={styles.loanText}>
                   Loan applied for this item
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

  const generateReceiptHTML = (
    sale: Sale,
    signature: string,
    description: string,
    userProfile: { username: string; shop_name: string } | null
  ) => {
    const itemsHTML = sale.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return `
          <tr>
            <td>${product?.name || 'Unknown Product'}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toLocaleString()}</td>
            <td>${(item.quantity * item.price).toLocaleString()}</td>
            ${
              product?.category === 'Phones' && product?.imei
                ? `<td>${product.imei}</td>` // Display IMEI for phones
                : ''
            }
          </tr>
        `;
      })
      .join('');

    return `
      <html>
        <body>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
                <th>IMEI</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  const downloadReceiptAsPDF = async () => {
    if (!currentSale) return;

    try {
      const htmlContent = generateReceiptHTML(currentSale, receiptSignature, receiptDescription, userProfile);
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      const fileName = `receipt_${currentSale.id.slice(-8)}.pdf`;
      const newUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.moveAsync({
        from: uri,
        to: newUri,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(newUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Download Receipt',
        });
      } else {
        Alert.alert('Success', `Receipt saved as ${fileName}`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF receipt');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t('pointOfSale')}</Text>
          <TouchableOpacity
            style={[styles.refreshButton, refreshing && styles.refreshingButton]}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
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

      {/* Discount Modal */}
      <Modal visible={showDiscountModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDiscountModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Apply Discount</Text>
            <TouchableOpacity onPress={confirmDiscount}>
              <Text style={styles.saveButton}>Apply</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {currentItem && (
              <View>
                <Text style={styles.loanProductName}>
                  {products.find(p => p.id === currentItem.productId)?.name}
                </Text>
                <Text style={styles.loanProductPrice}>
                  Original Price: {formatCurrency(products.find(p => p.id === currentItem.productId)?.sellingPrice || 0)}
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Discount Percentage (%)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={discountPercentage.toString()}
                    onChangeText={(text) => setDiscountPercentage(Number(text) || 0)}
                    placeholder="Enter discount % (e.g., 10)"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {discountPercentage >= 0 && discountPercentage <= 100 && (
                  <View style={styles.loanCalculation}>
                    <Text style={styles.loanCalculationText}>
                      Discounted Price: {formatCurrency(
                        (products.find(p => p.id === currentItem.productId)?.sellingPrice || 0) *
                        (1 - discountPercentage / 100)
                      )}
                    </Text>
                    <Text style={styles.loanCalculationText}>
                      Savings: {formatCurrency(
                        (products.find(p => p.id === currentItem.productId)?.sellingPrice || 0) *
                        (discountPercentage / 100) * currentItem.quantity
                      )}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal visible={showReceiptModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Sale Receipt</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={downloadReceiptAsPDF}
              >
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.downloadButtonText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                setShowReceiptModal(false);
                setReceiptSignature('');
                setReceiptDescription('');
              }}>
                <Text style={styles.saveButton}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalContent}>
            {currentSale && (
              <View>
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptTitle}>{userProfile?.shop_name || 'AlexShop'} Receipt</Text>
                  <Text style={styles.receiptDate}>
                    {new Date(currentSale.created_at).toLocaleDateString()} {new Date(currentSale.created_at).toLocaleTimeString()}
                  </Text>
                </View>

                <View style={styles.receiptItems}>
                  <Text style={styles.sectionTitle}>Items Purchased</Text>
                  {currentSale.items.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <View key={index} style={styles.receiptItem}>
                        <Text style={styles.receiptItemName}>
                          {product?.name || 'Unknown Product'}
                        </Text>
                        <Text style={styles.receiptItemDetails}>
                          {item.quantity} x {formatCurrency(item.price)} = {formatCurrency(item.quantity * item.price)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.receiptSummary}>
                  <View style={styles.receiptTotal}>
                    <Text style={styles.receiptTotalLabel}>Total:</Text>
                    <Text style={styles.receiptTotalAmount}>{formatCurrency(currentSale.total)}</Text>
                  </View>
                  <View style={styles.receiptPayment}>
                    <Text style={styles.receiptPaymentLabel}>Cash Received:</Text>
                    <Text style={styles.receiptPaymentAmount}>{formatCurrency(currentSale.cashReceived || 0)}</Text>
                  </View>
                  <View style={styles.receiptChange}>
                    <Text style={styles.receiptChangeLabel}>Change:</Text>
                    <Text style={styles.receiptChangeAmount}>{formatCurrency(currentSale.change || 0)}</Text>
                  </View>
                </View>

                {selectedCustomerData && (
                  <View style={styles.receiptCustomer}>
                    <Text style={styles.sectionTitle}>Customer Information</Text>
                    <Text style={styles.receiptCustomerName}>{selectedCustomerData.name}</Text>
                    <Text style={styles.receiptCustomerPhone}>{selectedCustomerData.phone}</Text>
                  </View>
                )}

                <View style={styles.receiptSignatureSection}>
                  <Text style={styles.sectionTitle}>Signature</Text>
                  <TextInput
                    style={styles.signatureInput}
                    value={receiptSignature}
                    onChangeText={setReceiptSignature}
                    placeholder="Enter signature/name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.receiptDescriptionSection}>
                  <Text style={styles.sectionTitle}>Description/Notes</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    value={receiptDescription}
                    onChangeText={setReceiptDescription}
                    placeholder="Add any notes or description"
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterText}>Thank you for your business{userProfile?.username ? `, ${userProfile.username}` : ''}!</Text>
                  <Text style={styles.receiptFooterText}>{userProfile?.shop_name || 'AlexShop'} - Your Trusted Partner</Text>
                </View>
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#111827',
  },
  refreshButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: '#2563EB',
  },
  refreshingButton: {
    opacity: 0.6,
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
  itemActions: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  discountButton: {
    backgroundColor: '#16A34A',
    width: width * 0.08,
    height: width * 0.08,
    borderRadius: width * 0.04,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.04,
    fontWeight: 'bold',
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
  activeLoanButton: {
    backgroundColor: '#D97706',
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
  discountText: {
    fontSize: width * 0.03,
    color: '#16A34A',
    fontStyle: 'italic',
    marginTop: width * 0.005,
  },
  loanText: {
    fontSize: width * 0.03,
    color: '#D97706',
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
  receiptHeader: {
    alignItems: 'center',
    marginBottom: width * 0.05,
    padding: width * 0.04,
    backgroundColor: '#F3F4F6',
    borderRadius: width * 0.03,
  },
  receiptTitle: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.02,
  },
  receiptDate: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  receiptItems: {
    marginBottom: width * 0.05,
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: width * 0.02,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  receiptItemName: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  receiptItemDetails: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  receiptSummary: {
    marginBottom: width * 0.05,
    padding: width * 0.04,
    backgroundColor: '#F3F4F6',
    borderRadius: width * 0.03,
  },
  receiptTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  receiptTotalLabel: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
  },
  receiptTotalAmount: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  receiptPayment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  receiptPaymentLabel: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  receiptPaymentAmount: {
    fontSize: width * 0.035,
    color: '#111827',
  },
  receiptChange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptChangeLabel: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  receiptChangeAmount: {
    fontSize: width * 0.035,
    color: '#111827',
  },
  receiptCustomer: {
    marginBottom: width * 0.05,
    padding: width * 0.04,
    backgroundColor: '#EBF4FF',
    borderRadius: width * 0.03,
  },
  receiptCustomerName: {
    fontSize: width * 0.04,
    fontWeight: '600',
    color: '#111827',
    marginBottom: width * 0.01,
  },
  receiptCustomerPhone: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  receiptSignatureSection: {
    marginBottom: width * 0.05,
  },
  signatureInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: width * 0.04,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  receiptDescriptionSection: {
    marginBottom: width * 0.05,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: width * 0.04,
    color: '#111827',
    backgroundColor: '#FFFFFF',
    minHeight: width * 0.2,
    textAlignVertical: 'top',
  },
  receiptFooter: {
    alignItems: 'center',
    padding: width * 0.04,
    backgroundColor: '#F3F4F6',
    borderRadius: width * 0.03,
  },
  receiptFooterText: {
    fontSize: width * 0.035,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: width * 0.01,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: width * 0.02,
  },
  downloadButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.01,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.035,
    fontWeight: '600',
  },
});