import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { ShoppingCart, Plus, Minus, Trash2, Calculator } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { formatCurrency } from '@/utils/currency';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';

interface CartItem {
  productId: string;
  quantity: number;
}

export default function SalesScreen() {
  const { t } = useLanguage();
  const { products, updateProductStock } = useProducts();
  const { addSale } = useSales();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');

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
      return total + (product ? product.sellingPrice * item.quantity : 0);
    }, 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert(t('error'), 'Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  const completeSale = () => {
    const total = getCartTotal();
    if (cashReceived < total) {
      Alert.alert(t('error'), 'Insufficient cash received');
      return;
    }

    // Update product stock
    cart.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        updateProductStock(item.productId, product.pieces - item.quantity);
      }
    });

    // Add sale record
    addSale({
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: products.find(p => p.id === item.productId)?.sellingPrice || 0,
      })),
      total,
      cashReceived,
      change: cashReceived - total,
    });

    // Reset
    setCart([]);
    setCashReceived(0);
    setShowCheckout(false);

    Alert.alert(t('success'), 'Sale completed successfully!');
  };

  const ProductCard = ({ product }: { product: any }) => {
    const cartItem = cart.find(item => item.productId === product.id);
    const quantityInCart = cartItem?.quantity || 0;
    const availableStock = product.pieces - quantityInCart;

    return (
      <View style={styles.productCard}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productBrand}>{product.brand}</Text>
          <Text style={styles.productPrice}>{formatCurrency(product.sellingPrice)}</Text>
          <Text style={styles.stockInfo}>
            Stock: {product.pieces} {quantityInCart > 0 && `(${availableStock} available)`}
          </Text>
        </View>
        
        {quantityInCart > 0 ? (
          <View style={styles.quantityControls}>
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
          </View>
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
          
          return (
            <View key={item.productId} style={styles.cartItem}>
              <Text style={styles.cartItemName}>{product.name}</Text>
              <Text style={styles.cartItemDetails}>
                {item.quantity} x {formatCurrency(product.sellingPrice)} = {formatCurrency(product.sellingPrice * item.quantity)}
              </Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('pointOfSale')}</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder={t('searchProducts')}
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholderTextColor="#9CA3AF"
      />

      <ScrollView style={styles.productsList} showsVerticalScrollIndicator={false}>
        {filteredProducts.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
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
  searchInput: {
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 2,
  },
  stockInfo: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    backgroundColor: '#2563EB',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    minWidth: 24,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cartSummary: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
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
    marginBottom: 12,
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  cartItem: {
    marginBottom: 8,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  cartItemDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  cartTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartTotalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  checkoutButton: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
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
  checkoutSummary: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  checkoutItem: {
    marginBottom: 12,
  },
  checkoutItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  checkoutItemPrice: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkoutTotal: {
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 12,
  },
  checkoutTotalText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'right',
  },
  paymentSection: {
    marginBottom: 24,
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
  changeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  changeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});