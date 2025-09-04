import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, useWindowDimensions } from 'react-native';
import { Receipt, Download, Search, Calendar, RefreshCw } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useSales, Sale } from '../../hooks/useSales';
import { useProducts } from '../../hooks/useProducts';
import { supabase } from '../../utils/supabase';

export default function ReceiptsScreen() {
  const { t } = useLanguage();
  const { sales, fetchSales, updateSale } = useSales();
  const { products, fetchProducts } = useProducts();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Debug modal state changes
  useEffect(() => {
    console.log('Modal visibility changed:', showReceiptModal);
  }, [showReceiptModal]);
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);
  const [pressedReceiptId, setPressedReceiptId] = useState<string | null>(null);
  const [receiptSignature, setReceiptSignature] = useState('');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [userProfile, setUserProfile] = useState<{username: string, shop_name: string, shop_logo?: string} | null>(null);
  const { width } = useWindowDimensions();
  const styles = createStyles(width);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSales();
    await fetchProducts();
    setRefreshing(false);
  }, [fetchSales, fetchProducts]);

  const filteredReceipts = sales.filter(receipt => {
    if (!searchTerm) return true;

    const receiptId = receipt.id.toLowerCase().includes(searchTerm.toLowerCase());
    const dateMatch = new Date(receipt.created_at).toLocaleDateString().toLowerCase().includes(searchTerm.toLowerCase());
    const totalMatch = formatCurrency(receipt.total).toLowerCase().includes(searchTerm.toLowerCase());

    return receiptId || dateMatch || totalMatch;
  });

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('username, shop_name, shop_logo')
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

  const viewReceipt = async (receipt: Sale) => {
    console.log('Viewing receipt:', receipt.id);
    setSelectedReceipt(receipt);
    setCustomerName(receipt.customer_name || '');
    setReceiptSignature(receipt.signature || '');
    setReceiptDescription(receipt.description || '');
    await fetchUserProfile();
    setShowReceiptModal(true);
    console.log('Modal should be visible now');
  };

  const generateReceiptHTML = (sale: Sale, userProfile: {username: string, shop_name: string, shop_logo?: string} | null) => {
    const date = new Date(sale.created_at).toLocaleDateString();
    const time = new Date(sale.created_at).toLocaleTimeString();
    const shopName = userProfile?.shop_name || 'Phone Shop POS';
    const username = userProfile?.username;
    const shopLogo = userProfile?.shop_logo;

    const itemsHTML = sale.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const itemPrice = item.price || 0;
      const itemTotal = item.quantity * itemPrice;
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${product?.name || 'Unknown Product'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">TSh ${itemPrice.toLocaleString()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">TSh ${itemTotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const signatureHTML = sale.signature ? `
      <div style="margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #2563eb;">Signature</h3>
        <div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; font-style: italic;">
          ${sale.signature}
        </div>
      </div>
    ` : '';

    const descriptionHTML = sale.description ? `
      <div style="margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #2563eb;">Notes</h3>
        <div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; white-space: pre-wrap;">
          ${sale.description}
        </div>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${shopName} Receipt</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 400px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header h1 {
              margin: 0;
              color: #2563eb;
              font-size: 24px;
            }
            .header p {
              margin: 5px 0;
              color: #666;
            }
            .content {
              background-color: white;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th {
              background-color: #f3f4f6;
              padding: 10px;
              text-align: left;
              border-bottom: 2px solid #e5e7eb;
            }
            .summary {
              margin: 20px 0;
              padding: 15px;
              background-color: #f3f4f6;
              border-radius: 8px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
            }
            .total {
              font-weight: bold;
              font-size: 18px;
              color: #16a34a;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding: 20px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .footer p {
              margin: 5px 0;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${shopLogo ? `<img src="${shopLogo}" alt="${shopName} Logo" style="max-width: 100px; max-height: 60px; margin-bottom: 10px;" />` : ''}
            <h1>${shopName}</h1>
            <p>Receipt #${sale.id.slice(-8).toUpperCase()}</p>
            <p>${date} ${time}</p>
          </div>

          <div class="content">
            ${sale.customer_name ? `<div style="margin-bottom: 20px; padding: 10px; background-color: #f0f9ff; border-radius: 8px; border-left: 4px solid #2563eb;">
              <strong style="color: #2563eb;">Customer:</strong> ${sale.customer_name}
            </div>` : ''}
            <h2 style="margin-top: 0; color: #2563eb;">Items Purchased</h2>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-row">
                <span>Total:</span>
                <span class="total">TSh ${(sale.total || 0).toLocaleString()}</span>
              </div>
              <div class="summary-row">
                <span>Cash Received:</span>
                <span>TSh ${(sale.cashReceived || 0).toLocaleString()}</span>
              </div>
              <div class="summary-row">
                <span>Change:</span>
                <span>TSh ${(sale.change || 0).toLocaleString()}</span>
              </div>
            </div>

            ${signatureHTML}
            ${descriptionHTML}
          </div>

          <div class="footer">
            <p>Thank you for your business${username ? `, ${username}` : ''}!</p>
            <p>${shopName} - Your Trusted Partner</p>
          </div>
        </body>
      </html>
    `;
  };

  const downloadReceiptAsPDF = async () => {
    if (!selectedReceipt) return;

    try {
      const htmlContent = generateReceiptHTML(selectedReceipt, userProfile);
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      const fileName = `receipt_${selectedReceipt.id.slice(-8)}.pdf`;
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

  const ReceiptList = () => {
    return (
      <View style={styles.receiptsContainer}>
        {filteredReceipts.map((receipt) => (
          <TouchableOpacity
            key={receipt.id}
            style={[
              styles.receiptCard,
              pressedReceiptId === receipt.id && styles.pressedReceiptCard
            ]}
            onPressIn={() => setPressedReceiptId(receipt.id)}
            onPressOut={() => setPressedReceiptId(null)}
            onPress={() => {
              setPressedReceiptId(null);
              viewReceipt(receipt);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.receiptHeader}>
              <View style={styles.receiptIdContainer}>
                <Receipt size={20} color="#2563EB" />
                <Text style={styles.receiptId}>#{receipt.id.slice(-8).toUpperCase()}</Text>
              </View>
              <Text style={styles.receiptDate}>
                {new Date(receipt.created_at).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.receiptDetails}>
              <Text style={styles.receiptTotal}>{formatCurrency(receipt.total)}</Text>
              <Text style={styles.receiptItemsCount}>
                {receipt.items.length} item{receipt.items.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.receiptTime}>
              <Text style={styles.receiptTimeText}>
                {new Date(receipt.created_at).toLocaleTimeString()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {filteredReceipts.length === 0 && (
          <View style={styles.emptyState}>
            <Receipt size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateText}>No receipts found</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchTerm ? 'Try adjusting your search' : 'Receipts will appear here after sales'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Receipts History</Text>
          <TouchableOpacity
            style={[styles.refreshButton, refreshing && styles.refreshingButton]}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search receipts by ID, date, or amount..."
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholderTextColor="#9CA3AF"
      />

      <ScrollView
        style={styles.receiptsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ReceiptList />
      </ScrollView>

      {/* Receipt Detail Modal */}
      <Modal visible={showReceiptModal} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Receipt Details</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={downloadReceiptAsPDF}
              >
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.downloadButtonText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                if (selectedReceipt) {
                  try {
                    await updateSale(selectedReceipt.id, {
                      customer_name: customerName || undefined,
                      signature: receiptSignature || undefined,
                      description: receiptDescription || undefined,
                    });
                    Alert.alert('Success', 'Receipt details saved successfully');
                  } catch (error) {
                    console.error('Error saving receipt details:', error);
                    Alert.alert('Error', 'Failed to save receipt details');
                    return;
                  }
                }
                setShowReceiptModal(false);
                setReceiptSignature('');
                setReceiptDescription('');
                setCustomerName('');
              }}>
                <Text style={styles.saveButton}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedReceipt && (
              <View>
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptTitle}>{userProfile?.shop_name || 'Phone Shop POS'} Receipt</Text>
                  <Text style={styles.receiptDate}>
                    {new Date(selectedReceipt.created_at).toLocaleDateString()} {new Date(selectedReceipt.created_at).toLocaleTimeString()}
                  </Text>
                </View>

                <View style={styles.receiptItems}>
                  <Text style={styles.sectionTitle}>Items Purchased</Text>
                  {selectedReceipt.items.map((item, index) => {
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
                  <View style={styles.receiptSummaryTotal}>
                    <Text style={styles.receiptTotalLabel}>Total:</Text>
                    <Text style={styles.receiptTotalAmount}>{formatCurrency(selectedReceipt.total)}</Text>
                  </View>
                  <View style={styles.receiptPayment}>
                    <Text style={styles.receiptPaymentLabel}>Cash Received:</Text>
                    <Text style={styles.receiptPaymentAmount}>{formatCurrency(selectedReceipt.cashReceived || 0)}</Text>
                  </View>
                  <View style={styles.receiptChange}>
                    <Text style={styles.receiptChangeLabel}>Change:</Text>
                    <Text style={styles.receiptChangeAmount}>{formatCurrency(selectedReceipt.change || 0)}</Text>
                  </View>
                </View>

                <View style={styles.receiptCustomerSection}>
                  <Text style={styles.sectionTitle}>Customer Name</Text>
                  <TextInput
                    style={styles.customerInput}
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder="Enter customer name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.receiptSignatureSection}>
                  <Text style={styles.sectionTitle}>Signature</Text>
                  <TextInput
                    style={styles.signatureInput}
                    value={receiptSignature}
                    onChangeText={setReceiptSignature}
                    placeholder="Enter signature"
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
                  <Text style={styles.receiptFooterText}>{userProfile?.shop_name || 'Phone Shop POS'} - Your Trusted Partner</Text>
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
  receiptsList: {
    flex: 1,
    paddingHorizontal: width * 0.03,
  },
  receiptsContainer: {
    paddingBottom: width * 0.05,
  },
  receiptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: width * 0.03,
    padding: width * 0.04,
    marginBottom: width * 0.03,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pressedReceiptCard: {
    backgroundColor: '#F3F4F6',
    transform: [{ scale: 0.98 }],
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  receiptIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: width * 0.02,
  },
  receiptId: {
    fontSize: width * 0.04,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  receiptDate: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  receiptDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  receiptTotal: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#16A34A',
  },
  receiptItemsCount: {
    fontSize: width * 0.035,
    color: '#6B7280',
  },
  receiptTime: {
    alignItems: 'flex-end',
  },
  receiptTimeText: {
    fontSize: width * 0.03,
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: width * 0.1,
  },
  emptyStateText: {
    fontSize: width * 0.05,
    fontWeight: 'bold',
    color: '#6B7280',
    marginTop: width * 0.05,
    marginBottom: width * 0.02,
  },
  emptyStateSubtext: {
    fontSize: width * 0.04,
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
  sectionTitle: {
    fontSize: width * 0.045,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.03,
  },
  receiptTitle: {
    fontSize: width * 0.06,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: width * 0.02,
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
  receiptSummaryTotal: {
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
  receiptCustomerSection: {
    marginBottom: width * 0.05,
  },
  customerInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: width * 0.04,
    color: '#111827',
    backgroundColor: '#FFFFFF',
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