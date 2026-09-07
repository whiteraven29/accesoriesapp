import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, useWindowDimensions, Platform } from 'react-native';
import { ShoppingCart, Plus, Minus, Trash2, Calculator, Users, CreditCard, RefreshCw, Download } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { Palette, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useProducts } from '../../hooks/useProducts';
import { useSales, Sale, SaleItem, PaymentMethod, PAYMENT_METHODS, REFERENCE_METHODS, WARRANTY_OPTIONS, warrantyState } from '../../hooks/useSales';
import { useAvailableUnits, createProductUnit } from '../../hooks/useProductUnits';
import { useCustomers } from '../../hooks/useCustomers';
import { supabase } from '../../utils/supabase';
import { discountedUnitPrice, lineTotal, roundMoney } from '../../utils/calculations';

interface CartItem {
  productId: string;
  quantity: number;
  discount?: number; // Percentage discount (0-100)
  useLoan?: boolean; // Whether to use loan for this item
  /**
   * IMEI unit ids for serialised products. A handset leaves the shop as a
   * specific device, so the line records which ones rather than just a count.
   */
  unitIds?: string[];
  /**
   * Warranty term in months, chosen by the seller. Only meaningful for
   * serialised lines, which is where the till exposes the control.
   */
  warrantyMonths?: number;
}

/**
 * The IMEIs handed over on a sale line, newest scheme first.
 *
 * `unitImeis` comes from the `product_units` rows bound to this sale item, so a
 * line selling three handsets prints three numbers. `productImei` is the
 * pre-v3 single column, kept only so receipts reprinted from sales made before
 * units existed still show what left the shop.
 */

/**
 * The warranty line for a receipt row.
 *
 * A line with no expiry is not "expired" — accessories and everything sold
 * before v5 simply carry no cover, and saying otherwise on a printed receipt
 * would invent a promise the shop never made.
 */
function warrantyLabel(
  item: SaleItem,
  t: (key: string) => string,
): string | null {
  if (!item.warrantyUntil) return null;
  const until = new Date(`${item.warrantyUntil}T23:59:59`);
  if (Number.isNaN(until.getTime())) return null;
  const term = item.warrantyMonths ? ` (${item.warrantyMonths} ${t('months')})` : '';
  return warrantyState(item.warrantyUntil) === 'expired'
    ? `${t('warrantyExpired')}: ${until.toLocaleDateString()}`
    : `${t('warrantyExpires')} ${until.toLocaleDateString()}${term}`;
}

/** Twelve months is what serialised stock was hardcoded to before v5. */
const DEFAULT_WARRANTY_MONTHS = 12;

function soldImeis(item: SaleItem, product?: { imei?: string }): string[] {
  if (item.unitImeis?.length) return item.unitImeis;
  const legacy = item.productImei || product?.imei;
  return legacy ? [legacy] : [];
}

export default function SalesScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const { products, addProduct, fetchProducts } = useProducts();
  const { addSale, fetchSales } = useSales();
  const { customers } = useCustomers();
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
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [receiptSignature, setReceiptSignature] = useState('');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [checkoutCustomerName, setCheckoutCustomerName] = useState('');
  const [userProfile, setUserProfile] = useState<{username: string, shop_name: string} | null>(null);
  const [currentItem, setCurrentItem] = useState<CartItem | null>(null);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [quickProduct, setQuickProduct] = useState({
    name: '', brand: '', category: 'Accessories', buyingPrice: 0,
    sellingPrice: 0, pieces: 1, lowStockAlert: 1, imei: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [completing, setCompleting] = useState(false);
  const { unitsByProduct } = useAvailableUnits();
  const { width } = useWindowDimensions();
  // StyleSheet.create used to re-run on every keystroke at the till; the
  // stylesheet only depends on width.
  const styles = useMemo(() => createStyles(width, c), [width, c]);

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

  /**
   * For a serialised product the cart holds the actual unit ids. They are
   * assigned oldest-first so stock rotates, and the database re-checks them at
   * checkout in case another till sold one in the meantime.
   */
  const nextUnitIds = (productId: string, quantity: number): string[] =>
    (unitsByProduct[productId] || []).slice(0, quantity).map(unit => unit.id);

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
      const nextQuantity = existingItem.quantity + 1;
      setCart(prev => prev.map(item =>
        item.productId === productId
          ? {
              ...item,
              quantity: nextQuantity,
              unitIds: product.isSerialized ? nextUnitIds(productId, nextQuantity) : undefined,
            }
          : item
      ));
    } else {
      setCart(prev => [...prev, {
        productId,
        quantity: 1,
        unitIds: product.isSerialized ? nextUnitIds(productId, 1) : undefined,
        warrantyMonths: product.isSerialized ? DEFAULT_WARRANTY_MONTHS : undefined,
      }]);
    }
  };

  const setWarrantyMonths = (productId: string, months: number) => {
    setCart(prev => prev.map(item =>
      item.productId === productId ? { ...item, warrantyMonths: months } : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.productId === productId);
      if (existingItem && existingItem.quantity > 1) {
        return prev.map(item =>
          item.productId === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
                // Drop the last assigned handset so ids stay in step with count.
                unitIds: item.unitIds?.slice(0, item.quantity - 1),
              }
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

      return total + lineTotal(
        discountedUnitPrice(product.sellingPrice, item.discount),
        item.quantity
      );
    }, 0);
  };

  const getLoanTotal = () => cart.reduce((total, item) => {
    if (!item.useLoan) return total;
    const product = products.find(p => p.id === item.productId);
    return product
      ? total + lineTotal(discountedUnitPrice(product.sellingPrice, item.discount), item.quantity)
      : total;
  }, 0);

  const getCashDue = () => Math.max(0, getCartTotal() - getLoanTotal());

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
    setCashReceived(getCashDue());
    setCheckoutCustomerName(selectedCustomerData?.name || '');
    setShowCheckout(true);
  };

  const saveQuickProduct = async () => {
    if (!quickProduct.name.trim() || !quickProduct.brand.trim() || !quickProduct.category.trim()) {
      Alert.alert(t('error'), 'Enter the product name, brand, and category.');
      return;
    }
    if (quickProduct.sellingPrice < 0 || quickProduct.buyingPrice < 0 || quickProduct.pieces < 1) {
      Alert.alert(t('error'), 'Enter valid prices and at least one item in stock.');
      return;
    }
    if (quickProduct.category === 'Phones' && !quickProduct.imei.trim()) {
      Alert.alert(t('error'), 'IMEI is required for phones.');
      return;
    }

    const isPhone = quickProduct.category === 'Phones';

    const { product: saved, error: saveError } = await addProduct({
      ...quickProduct,
      name: quickProduct.name.trim(),
      brand: quickProduct.brand.trim(),
      category: quickProduct.category.trim(),
      isSerialized: isPhone,
      // A handset's warranty runs a year by default; accessories carry none.
      warrantyDays: isPhone ? 365 : 0,
    });

    if (!saved) {
      Alert.alert(t('error'), saveError ?? 'Product could not be saved.');
      return;
    }

    // A serialised product has no stock until its first IMEI is registered.
    let unitIds: string[] | undefined;
    if (isPhone) {
      const { unit, error: unitError } = await createProductUnit({
        productId: saved.id,
        imei: quickProduct.imei.trim(),
        cost: quickProduct.buyingPrice,
      });

      if (!unit) {
        Alert.alert(t('error'), unitError === 'imeiAlreadyExists' ? t('imeiAlreadyExists')
          : unitError === 'imeiInvalid' ? t('imeiInvalid')
          : unitError ?? t('error'));
        return;
      }
      unitIds = [unit.id];
    }

    await fetchProducts();
    setCart(prev => [...prev, { productId: saved.id, quantity: 1, unitIds }]);
    setQuickProduct({
      name: '', brand: '', category: 'Accessories', buyingPrice: 0,
      sellingPrice: 0, pieces: 1, lowStockAlert: 1, imei: '',
    });
    setShowQuickProductModal(false);
  };

  const completeSale = async () => {
    const total = getCartTotal();
    const loanAmount = getLoanTotal();
    const cashDue = total - loanAmount;

    if (loanAmount > 0 && !selectedCustomer) {
      Alert.alert(t('error'), 'Select a customer for loan items');
      return;
    }
    if (cashReceived < cashDue) {
      Alert.alert(t('error'), 'Insufficient cash received');
      return;
    }

    // Mobile money is only traceable if the confirmation code is captured.
    if (REFERENCE_METHODS.includes(paymentMethod) && !paymentReference.trim()) {
      Alert.alert(t('error'), t('enterReference'));
      return;
    }

    // Every handset on the cart must still have its IMEI assigned; the database
    // re-checks, but failing here keeps the cashier out of a server round-trip.
    const missingUnits = cart.find(item => {
      const product = products.find(p => p.id === item.productId);
      return product?.isSerialized && (item.unitIds?.length ?? 0) !== item.quantity;
    });
    if (missingUnits) {
      const product = products.find(p => p.id === missingUnits.productId);
      Alert.alert(t('error'), `${t('unitsRequired')}: ${product?.name ?? ''}`);
      return;
    }

    setCompleting(true);
    const { sale, error } = await addSale(
      {
        total,
        cashReceived,
        customer_name: checkoutCustomerName.trim() || undefined,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
      },
      cart.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return { productId: item.productId, quantity: item.quantity, price: 0 };

        return {
          productId: item.productId,
          quantity: item.quantity,
          price: discountedUnitPrice(product.sellingPrice, item.discount),
          unitIds: item.unitIds,
          warrantyMonths: item.warrantyMonths,
        };
      }),
      selectedCustomer ?? undefined,
      loanAmount
    );
    setCompleting(false);

    if (!sale) {
      // Surface the database's own message ("Insufficient stock for Redmi 13C")
      // rather than a generic failure the cashier cannot act on.
      Alert.alert(t('error'), error ?? 'Sale could not be completed. Your cart was kept unchanged.');
      return;
    }

    setCurrentSale(sale);
    setShowReceiptModal(true);
    await fetchProducts();

    // Reset
    setCart([]);
    setCashReceived(0);
    setShowCheckout(false);
    setSelectedCustomer(null);
    setCheckoutCustomerName('');
    setPaymentMethod('cash');
    setPaymentReference('');
  };

  // Rendered as an element rather than a nested component: declaring a
  // component inside the render body gives React a new type on every
  // render, which unmounts and remounts the whole subtree.
  const productTable = (() => {
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
              <Text style={[styles.tableCell, { flex: 1, color: c.primary }]}>{formatCurrency(product.sellingPrice)}</Text>
              <Text style={[styles.tableCell, { flex: 1 }]}>{product.pieces}</Text>
              <View style={{ flex: 2, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                {quantityInCart > 0 ? (
                  <>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => removeFromCart(product.id)}
                    >
                      <Minus size={16} color={c.textInverse} />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantityInCart}</Text>
                    <TouchableOpacity
                      style={[styles.quantityButton, availableStock === 0 && styles.disabledButton]}
                      onPress={() => addToCart(product.id)}
                      disabled={availableStock === 0}
                    >
                      <Plus size={16} color={c.textInverse} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[styles.addButton, product.pieces === 0 && styles.disabledButton]}
                    onPress={() => addToCart(product.id)}
                    disabled={product.pieces === 0}
                  >
                    <Plus size={16} color={c.textInverse} />
                    <Text style={styles.addButtonText}>{t('addToCart')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  })();


  // Rendered as an element rather than a nested component: declaring a
  // component inside the render body gives React a new type on every
  // render, which unmounts and remounts the whole subtree.
  const cartSummary = (() => {
    if (cart.length === 0) return null;

    return (
      <View style={styles.cartSummary}>
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>{t('cart')} ({cart.length})</Text>
          <TouchableOpacity onPress={clearCart}>
            <Trash2 size={18} color={c.danger} />
          </TouchableOpacity>
        </View>
        
        {cart.map(item => {
           const product = products.find(p => p.id === item.productId);
           if (!product) return null;

           const basePrice = product.sellingPrice;
           const discountedPrice = discountedUnitPrice(basePrice, item.discount);
           const totalItemPrice = lineTotal(discountedPrice, item.quantity);

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
                       <CreditCard size={16} color={c.textInverse} />
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
               {/* Handsets leave under a promise the shop has to honour, so the
                   term is set per line at the till rather than per product. */}
               {product.isSerialized && (
                 <View style={styles.warrantyRow}>
                   <Text style={styles.warrantyLabel}>{t('warranty')}</Text>
                   <View style={styles.warrantyOptions}>
                     {WARRANTY_OPTIONS.map(months => {
                       const active = (item.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS) === months;
                       return (
                         <TouchableOpacity
                           key={months}
                           style={[styles.warrantyChip, active && styles.warrantyChipActive]}
                           onPress={() => setWarrantyMonths(item.productId, months)}
                           accessibilityRole="radio"
                           accessibilityState={{ selected: active }}
                           accessibilityLabel={`${t('warranty')} ${months} ${t('months')}`}
                         >
                           <Text style={[styles.warrantyChipText, active && styles.warrantyChipTextActive]}>
                             {months} {t('months')}
                           </Text>
                         </TouchableOpacity>
                       );
                     })}
                   </View>
                 </View>
               )}
             </View>
           );
         })}
        
        <View style={styles.cartTotal}>
          <Text style={styles.cartTotalText}>{t('total')}: {formatCurrency(getCartTotal())}</Text>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Calculator size={16} color={c.textInverse} />
            <Text style={styles.checkoutButtonText}>{t('checkout')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  })();


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

  useEffect(() => { fetchUserProfile(); }, []);

  const generateReceiptHTML = (
    sale: Sale,
    signature: string,
    description: string,
    userProfile: { username: string; shop_name: string } | null
  ) => {
    const escapeHtml = (value?: string) => (value || '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    })[character] || character);
    const shopName = escapeHtml(userProfile?.shop_name || 'Your Shop');
    const receiptNumber = sale.id.slice(-8).toUpperCase();
    const soldAt = new Date(sale.created_at);
    const itemsHTML = sale.items
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const productName = escapeHtml(item.productName || product?.name || 'Product');
        const imeiHTML = soldImeis(item, product)
          .map(value => `<small>IMEI: ${escapeHtml(value)}</small>`)
          .join('');
        const warranty = warrantyLabel(item, t);
        const warrantyHTML = warranty ? `<small>${escapeHtml(warranty)}</small>` : '';
        return `
          <tr>
            <td><strong>${productName}</strong>${imeiHTML}${warrantyHTML}</td>
            <td class="center">${item.quantity}</td>
            <td class="money">${formatCurrency(item.price)}</td>
            <td class="money">${formatCurrency(item.quantity * item.price)}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!doctype html><html><head><meta charset="utf-8"><style>
        *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;padding:24px;background:#f2f0fd}
        .receipt{max-width:680px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ef}
        header{padding:28px;background:#4A25C4;color:#fff;text-align:center}h1{margin:0 0 8px;font-size:28px}.meta{opacity:.9;font-size:13px}
        main{padding:26px}.customer,.notes{padding:12px 14px;background:#F1ECFE;border-left:4px solid #5F33E1;margin-bottom:18px}
        table{width:100%;border-collapse:collapse;font-size:13px}th{padding:10px 8px;text-align:left;background:#edf2f7;border-bottom:2px solid #cbd5e1}
        td{padding:12px 8px;border-bottom:1px solid #e5e7eb}small{display:block;color:#64748b;margin-top:4px}.center{text-align:center}.money{text-align:right;white-space:nowrap}
        .summary{margin:18px 0 0 auto;width:300px}.row{display:flex;justify-content:space-between;padding:6px 0}.total{font-size:18px;font-weight:700;border-top:2px solid #4A25C4;margin-top:5px;padding-top:10px;color:#4A25C4}
        footer{text-align:center;padding:20px;background:#f8fafc;color:#64748b;font-size:12px}@media(max-width:520px){body{padding:0}.receipt{border-radius:0}.summary{width:100%}main{padding:16px}}
      </style></head>
        <body>
        <div class="receipt"><header><h1>${shopName}</h1><div class="meta">SALES RECEIPT #${receiptNumber}<br>${soldAt.toLocaleDateString()} · ${soldAt.toLocaleTimeString()}</div></header><main>
          ${sale.customer_name ? `<div class="customer"><strong>Customer</strong><br>${escapeHtml(sale.customer_name)}</div>` : ''}
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th class="center">Qty</th>
                <th class="money">Unit price</th>
                <th class="money">Amount</th>
              </tr>
            </thead>
            <tbody>${itemsHTML}</tbody>
          </table>
          <div class="summary"><div class="row"><span>Cash received</span><strong>${formatCurrency(sale.cashReceived)}</strong></div><div class="row"><span>Change</span><strong>${formatCurrency(sale.change)}</strong></div><div class="row total"><span>Total</span><span>${formatCurrency(sale.total)}</span></div></div>
          ${description ? `<div class="notes"><strong>Notes</strong><br>${escapeHtml(description)}</div>` : ''}
          ${signature ? `<div class="notes"><strong>Served / signed by</strong><br>${escapeHtml(signature)}</div>` : ''}
        </main><footer>Thank you for shopping with ${shopName}.</footer></div></body></html>
    `;
  };

  const downloadReceiptAsPDF = async () => {
    if (!currentSale) return;

    try {
      const htmlContent = generateReceiptHTML(currentSale, receiptSignature, receiptDescription, userProfile);

      if (Platform.OS === 'web') {
        const receiptWindow = window.open('', '_blank', 'width=760,height=900');
        if (!receiptWindow) {
          Alert.alert(t('error'), t('allowPopups'));
          return;
        }
        receiptWindow.document.open();
        receiptWindow.document.write(htmlContent);
        receiptWindow.document.close();
        receiptWindow.focus();
        window.setTimeout(() => receiptWindow.print(), 350);
        return;
      }

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
            <RefreshCw size={18} color={c.textInverse} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Selection */}
      <View style={styles.customerSection}>
        <TouchableOpacity
          style={styles.customerButton}
          onPress={() => setShowCustomerModal(true)}
        >
          <Users size={18} color={c.textInverse} />
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

      <View style={styles.searchActions}>
        <TextInput
          style={[styles.searchInput, styles.searchInputInline]}
          placeholder={t('searchProducts')}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={c.textSubtle}
        />
        <TouchableOpacity style={styles.quickAddButton} onPress={() => setShowQuickProductModal(true)}>
          <Plus size={18} color={c.textInverse} />
          <Text style={styles.quickAddButtonText}>New product</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.productsList, styles.contentColumn]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ScrollView
          horizontal
          style={styles.tableScroll}
          contentContainerStyle={styles.tableScrollContent}
          showsHorizontalScrollIndicator={width < 768}
        >
          {productTable}
        </ScrollView>
      </ScrollView>

      {cartSummary}

      <Modal visible={showQuickProductModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQuickProductModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New product</Text>
            <TouchableOpacity onPress={saveQuickProduct}>
              <Text style={styles.saveButton}>Save & add</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Product name *</Text>
              <TextInput style={styles.textInput} value={quickProduct.name} onChangeText={name => setQuickProduct(p => ({ ...p, name }))} placeholder="Product name" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Brand *</Text>
              <TextInput style={styles.textInput} value={quickProduct.brand} onChangeText={brand => setQuickProduct(p => ({ ...p, brand }))} placeholder="Brand" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <View style={styles.quickCategories}>
                {['Accessories', 'Phones'].map(category => (
                  <TouchableOpacity key={category} style={[styles.quickCategory, quickProduct.category === category && styles.quickCategoryActive]} onPress={() => setQuickProduct(p => ({ ...p, category }))}>
                    <Text style={[styles.quickCategoryText, quickProduct.category === category && styles.quickCategoryTextActive]}>{category}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {quickProduct.category === 'Phones' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>IMEI *</Text>
                <TextInput style={styles.textInput} value={quickProduct.imei} onChangeText={imei => setQuickProduct(p => ({ ...p, imei }))} placeholder="IMEI" keyboardType="numeric" />
              </View>
            )}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Buying price (TSH) *</Text>
              <TextInput style={styles.textInput} value={quickProduct.buyingPrice.toString()} onChangeText={text => setQuickProduct(p => ({ ...p, buyingPrice: roundMoney(Number(text.replace(/[^0-9]/g, ''))) }))} keyboardType="numeric" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Selling price (TSH) *</Text>
              <TextInput style={styles.textInput} value={quickProduct.sellingPrice.toString()} onChangeText={text => setQuickProduct(p => ({ ...p, sellingPrice: roundMoney(Number(text.replace(/[^0-9]/g, ''))) }))} keyboardType="numeric" />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Stock quantity *</Text>
              <TextInput style={styles.textInput} value={quickProduct.pieces.toString()} onChangeText={text => setQuickProduct(p => ({ ...p, pieces: Math.max(0, Math.trunc(Number(text.replace(/[^0-9]/g, '')) || 0)) }))} keyboardType="numeric" />
            </View>
          </ScrollView>
        </View>
        </View>
      </Modal>

      <Modal visible={showCheckout} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCheckout(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('checkout')}</Text>
            <TouchableOpacity
              onPress={completeSale}
              disabled={completing}
              accessibilityRole="button"
              accessibilityLabel={t('completeSale')}
              accessibilityState={{ disabled: completing, busy: completing }}
            >
              <Text style={[styles.saveButton, completing && styles.saveButtonDisabled]}>
                {completing ? t('syncing') : t('completeSale')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.checkoutSummary}>
              <Text style={styles.sectionTitle}>{t('orderSummary')}</Text>
              {cart.map(item => {
                const product = products.find(p => p.id === item.productId);
                if (!product) return null;
                const unitPrice = discountedUnitPrice(product.sellingPrice, item.discount);
                
                return (
                  <View key={item.productId} style={styles.checkoutItem}>
                    <Text style={styles.checkoutItemName}>{product.name}</Text>
                    <Text style={styles.checkoutItemPrice}>
                      {item.quantity} × {formatCurrency(unitPrice)} = {formatCurrency(lineTotal(unitPrice, item.quantity))}
                      {item.useLoan ? ' (loan)' : ''}
                    </Text>
                  </View>
                );
              })}
              
              <View style={styles.checkoutTotal}>
                <Text style={styles.checkoutTotalText}>
                  {t('total')}: {formatCurrency(getCartTotal())}
                </Text>
                {getLoanTotal() > 0 && (
                  <Text style={styles.checkoutItemPrice}>{t('loan')}: {formatCurrency(getLoanTotal())}</Text>
                )}
                <Text style={styles.checkoutItemPrice}>Cash due: {formatCurrency(getCashDue())}</Text>
              </View>
            </View>

            <View style={styles.paymentSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('customerNameOptional')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={checkoutCustomerName}
                  onChangeText={setCheckoutCustomerName}
                  placeholder={t('enterCustomerReceipt')}
                  autoCapitalize="words"
                  placeholderTextColor={c.textSubtle}
                />
              </View>
              <Text style={styles.sectionTitle}>{t('payment')}</Text>

              {/* Mobile money is the default rail in this market, so the method
                  is picked explicitly rather than assumed to be cash. */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('paymentMethod')}</Text>
                <View style={styles.paymentGrid}>
                  {PAYMENT_METHODS.map(method => {
                    const selected = paymentMethod === method.value;
                    return (
                      <TouchableOpacity
                        key={method.value}
                        onPress={() => setPaymentMethod(method.value)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={t(method.labelKey)}
                        style={[styles.paymentChip, selected && styles.paymentChipActive]}
                      >
                        <Text style={[styles.paymentChipText, selected && styles.paymentChipTextActive]}>
                          {t(method.labelKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {REFERENCE_METHODS.includes(paymentMethod) && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('transactionRef')} *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={paymentReference}
                    onChangeText={setPaymentReference}
                    placeholder={t('enterReference')}
                    autoCapitalize="characters"
                    placeholderTextColor={c.textSubtle}
                    accessibilityLabel={t('transactionRef')}
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {paymentMethod === 'cash' ? `${t('cash')} (TSH)` : `${t('amount')} (TSH)`}
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={cashReceived.toString()}
                  onChangeText={(text) => setCashReceived(roundMoney(Number(text.replace(/[^0-9]/g, ''))))}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={c.textSubtle}
                />
              </View>
              
              {cashReceived > 0 && (
                <View style={styles.changeInfo}>
                  <Text style={styles.changeLabel}>{t('change')}:</Text>
                  <Text style={[styles.changeAmount, { 
                    color: cashReceived >= getCashDue() ? c.success : c.danger 
                  }]}> 
                    {formatCurrency(Math.max(0, cashReceived - getCashDue()))}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
        </View>
      </Modal>

      {/* Customer Selection Modal */}
      <Modal visible={showCustomerModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('selectCustomerTitle')}</Text>
            <TouchableOpacity onPress={() => setShowCustomerModal(false)}>
              <Text style={styles.saveButton}>{t('done')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <TouchableOpacity
              style={[styles.customerOption, !selectedCustomer && styles.selectedCustomer]}
              onPress={() => selectCustomer(null)}
            >
              <Text style={[styles.customerOptionText, !selectedCustomer && styles.selectedCustomerText]}>
                {t('cashSaleNoCustomer')}
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
        </View>
      </Modal>

      {/* Discount Modal */}
      <Modal visible={showDiscountModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDiscountModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('applyDiscount')}</Text>
            <TouchableOpacity onPress={confirmDiscount}>
              <Text style={styles.saveButton}>{t('apply')}</Text>
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
                  <Text style={styles.inputLabel}>{t('discountPercentage')}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={discountPercentage.toString()}
                    onChangeText={(text) => setDiscountPercentage(Number(text) || 0)}
                    placeholder="Enter discount % (e.g., 10)"
                    keyboardType="numeric"
                    placeholderTextColor={c.textSubtle}
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
        </View>
      </Modal>

      {/* Receipt Modal */}
      <Modal visible={showReceiptModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('saleReceipt')}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={downloadReceiptAsPDF}
              >
                <Download size={16} color={c.textInverse} />
                <Text style={styles.downloadButtonText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => {
                setShowReceiptModal(false);
                setReceiptSignature('');
                setReceiptDescription('');
              }}>
                <Text style={styles.saveButton}>{t('done')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalContent}>
            {currentSale && (
              <View>
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptTitle}>{userProfile?.shop_name || 'Your Shop'}</Text>
                  <Text style={styles.receiptNumber}>RECEIPT #{currentSale.id.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.receiptDate}>
                    {new Date(currentSale.created_at).toLocaleDateString()} {new Date(currentSale.created_at).toLocaleTimeString()}
                  </Text>
                </View>

                <View style={styles.receiptItems}>
                  <Text style={styles.sectionTitle}>{t('itemsPurchased')}</Text>
                  {currentSale.items.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    return (
                      <View key={index} style={styles.receiptItem}>
                        <View style={styles.receiptItemMain}>
                          <Text style={styles.receiptItemName}>
                            {item.productName || product?.name || 'Product'}
                          </Text>
                          {soldImeis(item, product).map(imei => (
                            <Text key={imei} style={styles.receiptItemImei} selectable>
                              IMEI: {imei}
                            </Text>
                          ))}
                          {warrantyLabel(item, t) ? (
                            <Text style={styles.receiptItemImei}>{warrantyLabel(item, t)}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.receiptItemDetails}>
                          {item.quantity} x {formatCurrency(item.price)} = {formatCurrency(item.quantity * item.price)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.receiptSummary}>
                  <View style={styles.receiptTotal}>
                    <Text style={styles.receiptTotalLabel}>{t('total')}:</Text>
                    <Text style={styles.receiptTotalAmount}>{formatCurrency(currentSale.total)}</Text>
                  </View>
                  <View style={styles.receiptPayment}>
                    <Text style={styles.receiptPaymentLabel}>{t('cashReceived')}:</Text>
                    <Text style={styles.receiptPaymentAmount}>{formatCurrency(currentSale.cashReceived || 0)}</Text>
                  </View>
                  <View style={styles.receiptChange}>
                    <Text style={styles.receiptChangeLabel}>{t('change')}:</Text>
                    <Text style={styles.receiptChangeAmount}>{formatCurrency(currentSale.change || 0)}</Text>
                  </View>
                </View>

                {currentSale.customer_name && (
                  <View style={styles.receiptCustomer}>
                    <Text style={styles.sectionTitle}>{t('customerInformation')}</Text>
                    <Text style={styles.receiptCustomerName}>{currentSale.customer_name}</Text>
                  </View>
                )}

                <View style={styles.receiptSignatureSection}>
                  <Text style={styles.sectionTitle}>{t('signature')}</Text>
                  <TextInput
                    style={styles.signatureInput}
                    value={receiptSignature}
                    onChangeText={setReceiptSignature}
                    placeholder="Enter signature/name"
                    placeholderTextColor={c.textSubtle}
                  />
                </View>

                <View style={styles.receiptDescriptionSection}>
                  <Text style={styles.sectionTitle}>{t('notes')}</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    value={receiptDescription}
                    onChangeText={setReceiptDescription}
                    placeholder="Add any notes or description"
                    multiline
                    numberOfLines={3}
                    placeholderTextColor={c.textSubtle}
                  />
                </View>

                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterText}>Thank you for your business{userProfile?.username ? `, ${userProfile.username}` : ''}!</Text>
                  <Text style={styles.receiptFooterText}>{userProfile?.shop_name || 'Your Shop'}</Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
        </View>
      </Modal>
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
    padding: width * 0.03,
    paddingTop: width * 0.03,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: c.text,
  },
  refreshButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: c.primary,
  },
  refreshingButton: {
    opacity: 0.6,
  },
  customerSection: {
    margin: width * 0.03,
    marginTop: 0,
  },
  customerButton: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.02,
  },
  customerButtonText: {
    color: c.textInverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  customerInfo: {
    marginTop: width * 0.02,
    padding: width * 0.03,
    backgroundColor: c.surfaceSunken,
    borderRadius: width * 0.025,
  },
  customerName: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
  },
  customerBalance: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginTop: width * 0.01,
  },
  searchInput: {
    margin: width * 0.03,
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.025,
    backgroundColor: c.surface,
    borderRadius: width * 0.025,
    borderWidth: 1,
    borderColor: c.border,
    fontSize: fontSize.md,
    color: c.text,
  },
  searchActions: {
    flexDirection: viewportWidth < 600 ? 'column' : 'row',
    alignItems: 'stretch',
    gap: width * 0.02,
    marginHorizontal: width * 0.03,
    marginBottom: width * 0.02,
  },
  searchInputInline: {
    flex: 1,
    margin: 0,
  },
  quickAddButton: {
    minHeight: 48,
    paddingHorizontal: width * 0.04,
    borderRadius: width * 0.025,
    backgroundColor: c.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickAddButtonText: {
    color: c.textInverse,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  quickCategories: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  quickCategory: {
    flex: 1,
    padding: width * 0.03,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    alignItems: 'center',
  },
  quickCategoryActive: {
    backgroundColor: c.primaryTint,
    borderColor: c.primary,
  },
  quickCategoryText: {
    color: c.textMuted,
    fontWeight: '600',
  },
  quickCategoryTextActive: {
    color: c.primaryPressed,
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
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.005,
  },
  productBrand: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginBottom: width * 0.01,
  },
  productPrice: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.primary,
    marginBottom: width * 0.005,
  },
  stockInfo: {
    fontSize: fontSize.sm,
    color: c.textSubtle,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: width * 0.025,
  },
  quantityButton: {
    backgroundColor: c.primary,
    width: width * 0.08,
    height: width * 0.08,
    borderRadius: width * 0.04,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: c.textSubtle,
  },
  quantityText: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
    minWidth: width * 0.06,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.01,
  },
  addButtonText: {
    color: c.textInverse,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  cartSummary: {
    backgroundColor: c.surface,
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
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
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
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: c.text,
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  discountButton: {
    backgroundColor: c.success,
    width: width * 0.08,
    height: width * 0.08,
    borderRadius: width * 0.04,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountButtonText: {
    color: c.textInverse,
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  loanButton: {
    backgroundColor: c.info,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.02,
    paddingVertical: width * 0.01,
    borderRadius: width * 0.015,
    gap: width * 0.01,
  },
  activeLoanButton: {
    backgroundColor: c.warning,
  },
  loanButtonText: {
    color: c.textInverse,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  loanDiscountText: {
    fontSize: fontSize.sm,
    color: c.info,
    fontStyle: 'italic',
    marginTop: width * 0.005,
  },
  discountText: {
    fontSize: fontSize.sm,
    color: c.success,
    fontStyle: 'italic',
    marginTop: width * 0.005,
  },
  warrantyRow: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  warrantyLabel: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontWeight: fontWeight.semibold,
  },
  warrantyOptions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  warrantyChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: c.primaryTint,
  },
  warrantyChipActive: {
    backgroundColor: c.primary,
  },
  warrantyChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  warrantyChipTextActive: {
    color: c.textInverse,
  },
  loanText: {
    fontSize: fontSize.sm,
    color: c.warning,
    fontStyle: 'italic',
    marginTop: width * 0.005,
  },
  cartItemDetails: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  cartTotal: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: width * 0.025,
    marginTop: width * 0.02,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartTotalText: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
  },
  checkoutButton: {
    backgroundColor: c.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.01,
  },
  checkoutButtonText: {
    color: c.textInverse,
    fontSize: fontSize.sm,
    fontWeight: '600',
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
  saveButtonDisabled: {
    color: c.textSubtle,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  paymentChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  paymentChipText: {
    color: c.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  paymentChipTextActive: {
    color: c.textInverse,
  },
  modalContent: {
    flex: 1,
    padding: width * 0.03,
  },
  checkoutSummary: {
    marginBottom: width * 0.05,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.03,
  },
  checkoutItem: {
    marginBottom: width * 0.025,
  },
  checkoutItemName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.text,
  },
  checkoutItemPrice: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  checkoutTotal: {
    borderTopWidth: 2,
    borderTopColor: c.border,
    paddingTop: width * 0.025,
    marginTop: width * 0.025,
  },
  checkoutTotalText: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: c.text,
    textAlign: 'right',
  },
  paymentSection: {
    marginBottom: width * 0.05,
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
  changeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.surfaceSunken,
    padding: width * 0.03,
    borderRadius: width * 0.025,
  },
  changeLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.textMuted,
  },
  changeAmount: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  tableContainer: {
    minWidth: viewportWidth < 768 ? 720 : '100%',
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
  customerOption: {
    padding: width * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceSunken,
  },
  selectedCustomer: {
    backgroundColor: c.primaryTint,
  },
  customerOptionText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.text,
  },
  selectedCustomerText: {
    color: c.primary,
  },
  customerOptionDetails: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginTop: width * 0.01,
  },
  loanProductName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.02,
  },
  loanProductPrice: {
    fontSize: fontSize.md,
    color: c.textMuted,
    marginBottom: width * 0.03,
  },
  loanCalculation: {
    backgroundColor: c.surfaceSunken,
    padding: width * 0.03,
    borderRadius: width * 0.025,
    marginTop: width * 0.03,
  },
  loanCalculationText: {
    fontSize: fontSize.md,
    color: c.text,
    marginBottom: width * 0.01,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: width * 0.05,
    padding: width * 0.04,
    backgroundColor: c.surfaceSunken,
    borderRadius: width * 0.03,
  },
  receiptTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.02,
  },
  receiptNumber: {
    marginTop: 6,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
    color: c.primary,
  },
  receiptDate: {
    fontSize: fontSize.sm,
    color: c.textMuted,
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
    borderBottomColor: c.surfaceSunken,
  },
  receiptItemMain: {
    flex: 1,
  },
  receiptItemName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.text,
  },
  receiptItemImei: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
  },
  receiptItemDetails: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  receiptSummary: {
    marginBottom: width * 0.05,
    padding: width * 0.04,
    backgroundColor: c.surfaceSunken,
    borderRadius: width * 0.03,
  },
  receiptTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  receiptTotalLabel: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
  },
  receiptTotalAmount: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.success,
  },
  receiptPayment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  receiptPaymentLabel: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  receiptPaymentAmount: {
    fontSize: fontSize.sm,
    color: c.text,
  },
  receiptChange: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptChangeLabel: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  receiptChangeAmount: {
    fontSize: fontSize.sm,
    color: c.text,
  },
  receiptCustomer: {
    marginBottom: width * 0.05,
    padding: width * 0.04,
    backgroundColor: c.primaryTint,
    borderRadius: width * 0.03,
  },
  receiptCustomerName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: c.text,
    marginBottom: width * 0.01,
  },
  receiptCustomerPhone: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  receiptSignatureSection: {
    marginBottom: width * 0.05,
  },
  signatureInput: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.surface,
  },
  receiptDescriptionSection: {
    marginBottom: width * 0.05,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.surface,
    minHeight: width * 0.2,
    textAlignVertical: 'top',
  },
  receiptFooter: {
    alignItems: 'center',
    padding: width * 0.04,
    backgroundColor: c.surfaceSunken,
    borderRadius: width * 0.03,
  },
  receiptFooterText: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: width * 0.01,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: width * 0.02,
  },
  downloadButton: {
    backgroundColor: c.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: width * 0.03,
    paddingVertical: width * 0.02,
    borderRadius: width * 0.025,
    gap: width * 0.01,
  },
  downloadButtonText: {
    color: c.textInverse,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  });
};
