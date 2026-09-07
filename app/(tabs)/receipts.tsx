import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, RefreshControl, useWindowDimensions, Platform } from 'react-native';
import { Receipt, Download, RefreshCw, RotateCcw, Share2, ShieldAlert, Archive } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { formatCurrency } from '../../utils/currency';
import { useSales, Sale, SaleItem, PaymentMethod, warrantyState } from '../../hooks/useSales';
import { useReturns } from '../../hooks/useReturns';
import { supabase } from '../../utils/supabase';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { Palette, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { useFocusEffect } from 'expo-router';

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'cashPayment',
  mpesa: 'mpesa',
  tigopesa: 'tigopesa',
  airtelmoney: 'airtelmoney',
  halopesa: 'halopesa',
  azampesa: 'azampesa',
  bank: 'bankTransfer',
  credit: 'loan',
  split: 'splitPayment',
};

/**
 * The IMEIs handed over on a sale line. Mirrors the till's own resolver: the
 * units bound to this sale item, falling back to the pre-v3 single column so
 * old receipts still reprint with the number that left the shop.
 */
function soldImeis(item: SaleItem): string[] {
  if (item.unitImeis?.length) return item.unitImeis;
  return item.productImei ? [item.productImei] : [];
}


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

/**
 * This template interpolates shop-entered text straight into HTML, so a product
 * name containing `<` would otherwise break the printed receipt.
 */
const escapeHtml = (value?: string) => (value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
})[character] || character);

export default function ReceiptsScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const { sales, fetchSales, updateSale, setSaleArchived } = useSales();
  const { processReturn } = useReturns();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  /**
   * Faulty stock goes back as faulty, not as sellable — the distinction that
   * keeps a broken handset off the shelf.
   */
  const startReturn = (item: SaleItem) => {
    const confirm = async (restock: boolean) => {
      const { id, error } = await processReturn({
        saleItemId: item.id,
        quantity: item.quantity,
        reason: restock ? 'customer_return' : 'faulty',
        restock,
      });

      if (!id) {
        Alert.alert(t('error'), error ?? t('error'));
        return;
      }
      Alert.alert(t('success'), t('returnRecorded'));
      await fetchSales();
      setSelectedReceipt(null);
    };

    Alert.alert(t('returnSale'), `${item.productName ?? ''} · ${item.quantity} ×`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('unitInStock'), onPress: () => confirm(true) },
      { text: t('unitFaulty'), style: 'destructive', onPress: () => confirm(false) },
    ]);
  };
  const [pressedReceiptId, setPressedReceiptId] = useState<string | null>(null);
  /** Archived receipts are filed away, not gone. Off by default, one tap back. */
  const [showArchived, setShowArchived] = useState(false);
  const [receiptSignature, setReceiptSignature] = useState('');
  const [receiptDescription, setReceiptDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [userProfile, setUserProfile] = useState<{username: string, shop_name: string} | null>(null);
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(width, c), [width, c]);

  useEffect(() => { fetchUserProfile(); }, []);
  useFocusEffect(useCallback(() => {
    fetchSales();
  }, [fetchSales]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchSales(), fetchUserProfile()]);
    setRefreshing(false);
  }, [fetchSales]);

  const archivedCount = sales.filter(receipt => receipt.archivedAt).length;

  const filteredReceipts = sales.filter(receipt => {
    if (Boolean(receipt.archivedAt) !== showArchived) return false;
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

  const viewReceipt = async (receipt: Sale) => {
    setSelectedReceipt(receipt);
    setCustomerName(receipt.customer_name || '');
    setReceiptSignature(receipt.signature || '');
    setReceiptDescription(receipt.description || '');
    setShowReceiptModal(true);
  };

  const generateReceiptHTML = (sale: Sale, userProfile: {username: string, shop_name: string} | null) => {
    const date = new Date(sale.created_at).toLocaleDateString();
    const time = new Date(sale.created_at).toLocaleTimeString();
    const shopName = userProfile?.shop_name || 'Phone Shop POS';
    const username = userProfile?.username;

    const itemsHTML = sale.items.map(item => {
      const itemPrice = item.price || 0;
      const itemTotal = item.quantity * itemPrice;
      const imeiHTML = soldImeis(item)
        .map(value => `<div style="font-size: 11px; color: #666; margin-top: 3px;">IMEI: ${escapeHtml(value)}</div>`)
        .join('');
      const warranty = warrantyLabel(item, t);
      const warrantyHTML = warranty
        ? `<div style="font-size: 11px; color: #666; margin-top: 3px;">${escapeHtml(warranty)}</div>`
        : '';
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(item.productName || 'Product')}${imeiHTML}${warrantyHTML}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">TSh ${itemPrice.toLocaleString()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">TSh ${itemTotal.toLocaleString()}</td>
        </tr>
      `;
    }).join('');

    const signatureHTML = sale.signature ? `
      <div style="margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #5F33E1;">${t('signature')}</h3>
        <div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; font-style: italic;">
          ${sale.signature}
        </div>
      </div>
    ` : '';

    const descriptionHTML = sale.description ? `
      <div style="margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #5F33E1;">${t('notes')}</h3>
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
              color: #5F33E1;
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
            <h1>${shopName}</h1>
            <p>Receipt #${sale.id.slice(-8).toUpperCase()}</p>
            <p>${date} ${time}</p>
          </div>

          <div class="content">
            ${sale.customer_name ? `<div style="margin-bottom: 20px; padding: 10px; background-color: #F1ECFE; border-radius: 8px; border-left: 4px solid #5F33E1;">
              <strong style="color: #5F33E1;">${t('customerName')}:</strong> ${sale.customer_name}
            </div>` : ''}
            <h2 style="margin-top: 0; color: #5F33E1;">${t('itemsPurchased')}</h2>
            <table>
              <thead>
                <tr>
                  <th>${t('product')}</th>
                  <th style="text-align: center;">${t('quantity')}</th>
                  <th style="text-align: right;">${t('price')}</th>
                  <th style="text-align: right;">${t('total')}</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHTML}
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-row">
                <span>${t('total')}:</span>
                <span class="total">TSh ${(sale.total || 0).toLocaleString()}</span>
              </div>
              <div class="summary-row">
                <span>${t('cashReceived')}:</span>
                <span>TSh ${(sale.cashReceived || 0).toLocaleString()}</span>
              </div>
              <div class="summary-row">
                <span>${t('change')}:</span>
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

  const downloadReceiptAsPDF = async (receipt: Sale | null = selectedReceipt) => {
    if (!receipt) return;

    try {
      const htmlContent = generateReceiptHTML(receipt, userProfile);

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

      const fileName = `receipt_${receipt.id.slice(-8)}.pdf`;

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

  // Rendered as an element rather than a nested component: declaring a
  // component inside the render body gives React a new type on every
  // render, which unmounts and remounts the whole subtree.
  const receiptList = (() => {
    return (
      <View style={styles.receiptsContainer}>
        {archivedCount > 0 ? (
          <TouchableOpacity
            style={styles.archiveToggle}
            onPress={() => setShowArchived(previous => !previous)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showArchived }}
            accessibilityLabel={t('showArchived')}
          >
            <Archive size={15} color={c.primary} />
            <Text style={styles.archiveToggleText}>
              {showArchived ? t('showActive') : `${t('showArchived')} (${archivedCount})`}
            </Text>
          </TouchableOpacity>
        ) : null}

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
                <Receipt size={18} color={c.primary} />
                <Text style={styles.receiptId}>#{receipt.id.slice(-8).toUpperCase()}</Text>
              </View>
              <Text style={styles.receiptDate}>
                {new Date(receipt.created_at).toLocaleDateString()}
              </Text>
            </View>

            {/* The shop's obligation on this sale has ended. The record stays. */}
            {receipt.items.some(item => warrantyState(item.warrantyUntil) === 'expired') ? (
              <View style={styles.expiredWarrantyPill}>
                <ShieldAlert size={13} color={c.warning} />
                <Text style={styles.expiredWarrantyText}>{t('warrantyExpired')}</Text>
              </View>
            ) : null}

            <View style={styles.receiptDetails}>
              <Text style={styles.receiptTotal}>{formatCurrency(receipt.total)}</Text>
              <Text style={styles.receiptItemsCount}>
                {receipt.items.length} item{receipt.items.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {receipt.customer_name ? (
              <Text style={styles.receiptCustomerName}>Customer: {receipt.customer_name}</Text>
            ) : null}

            <View style={styles.receiptTime}>
              <Text style={styles.receiptTimeText}>
                {new Date(receipt.created_at).toLocaleTimeString()}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.cardArchiveButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    setSaleArchived(receipt.id, !receipt.archivedAt);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={receipt.archivedAt ? t('restoreReceipt') : t('archiveReceipt')}
                >
                  <Archive size={15} color={c.primary} />
                  <Text style={styles.cardArchiveText}>
                    {receipt.archivedAt ? t('restoreReceipt') : t('archiveReceipt')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cardShareButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    downloadReceiptAsPDF(receipt);
                  }}
                >
                  <Share2 size={16} color={c.textInverse} />
                  <Text style={styles.cardShareText}>{t('shareReceipt')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredReceipts.length === 0 && (
          <View style={styles.emptyState}>
            <Receipt size={48} color={c.textSubtle} />
            <Text style={styles.emptyStateText}>{t('noReceipts')}</Text>
            <Text style={styles.emptyStateSubtext}>
              {searchTerm ? t('adjustSearch') : t('receiptsAfterSales')}
            </Text>
          </View>
        )}
      </View>
    );
  })();


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>{userProfile?.shop_name || 'Your Shop'}</Text>
            <Text style={styles.headerSubtitle}>{t('receiptsHistory')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, refreshing && styles.refreshingButton]}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={18} color={c.textInverse} />
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder={t('searchReceipts')}
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholderTextColor={c.textSubtle}
      />

      <ScrollView
        style={[styles.receiptsList, styles.contentColumn]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {receiptList}
      </ScrollView>

      {/* Receipt Detail Modal */}
      <Modal visible={showReceiptModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReceiptModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('receiptDetails')}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => downloadReceiptAsPDF()}
              >
                <Download size={16} color={c.textInverse} />
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
                <Text style={styles.saveButton}>{t('done')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedReceipt && (
              <View>
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptTitle}>{userProfile?.shop_name || 'Your Shop'}</Text>
                  <Text style={styles.receiptId}>Receipt #{selectedReceipt.id.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.receiptDate}>
                    {new Date(selectedReceipt.created_at).toLocaleDateString()} {new Date(selectedReceipt.created_at).toLocaleTimeString()}
                  </Text>
                </View>

                <View style={styles.receiptItems}>
                  <Text style={styles.sectionTitle}>{t('itemsPurchased')}</Text>
                  {selectedReceipt.items.map((item, index) => {
                    return (
                      <View key={index} style={styles.receiptItem}>
                        <View style={styles.receiptItemMain}>
                          <Text style={styles.receiptItemName}>
                            {item.productName || 'Product'}
                          </Text>
                          {soldImeis(item).map(imei => (
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

                {/* Returns: phones come back under warranty or faulty, and the
                    app previously had no way to reverse a sale at all. */}
                <View style={styles.returnSection}>
                  <Text style={styles.sectionTitle}>{t('returnSale')}</Text>
                  {selectedReceipt.status !== 'completed' ? (
                    <Text style={styles.returnedNotice}>
                      {selectedReceipt.status === 'returned' ? t('unitReturned') : t('processReturn')}
                    </Text>
                  ) : null}
                  {selectedReceipt.items.map(item => (
                    <TouchableOpacity
                      key={`return-${item.id}`}
                      style={styles.returnRow}
                      onPress={() => startReturn(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('returnSale')}: ${item.productName ?? ''}`}
                    >
                      <RotateCcw size={16} color={c.warning} />
                      <Text style={styles.returnRowText} numberOfLines={1}>
                        {item.productName ?? '—'} · {item.quantity} ×
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.receiptSummary}>
                  <View style={styles.receiptSummaryTotal}>
                    <Text style={styles.receiptTotalLabel}>{t('total')}:</Text>
                    <Text style={styles.receiptTotalAmount}>{formatCurrency(selectedReceipt.total)}</Text>
                  </View>
                  <View style={styles.receiptPayment}>
                    <Text style={styles.receiptPaymentLabel}>{t('paymentMethod')}:</Text>
                    <Text style={styles.receiptPaymentAmount}>
                      {t(PAYMENT_LABEL[selectedReceipt.paymentMethod] ?? 'cashPayment')}
                      {selectedReceipt.paymentReference ? ` · ${selectedReceipt.paymentReference}` : ''}
                    </Text>
                  </View>
                  <View style={styles.receiptPayment}>
                    <Text style={styles.receiptPaymentLabel}>{t('cashReceived')}:</Text>
                    <Text style={styles.receiptPaymentAmount}>{formatCurrency(selectedReceipt.cashReceived || 0)}</Text>
                  </View>
                  <View style={styles.receiptChange}>
                    <Text style={styles.receiptChangeLabel}>{t('change')}:</Text>
                    <Text style={styles.receiptChangeAmount}>{formatCurrency(selectedReceipt.change || 0)}</Text>
                  </View>
                </View>

                <View style={styles.receiptCustomerSection}>
                  <Text style={styles.sectionTitle}>{t('customerName')}</Text>
                  <TextInput
                    style={styles.customerInput}
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder={t('enterCustomerReceipt')}
                    placeholderTextColor={c.textSubtle}
                  />
                </View>

                <View style={styles.receiptSignatureSection}>
                  <Text style={styles.sectionTitle}>{t('signature')}</Text>
                  <TextInput
                    style={styles.signatureInput}
                    value={receiptSignature}
                    onChangeText={setReceiptSignature}
                    placeholder={t('enterSignature')}
                    placeholderTextColor={c.textSubtle}
                  />
                </View>

                <View style={styles.receiptDescriptionSection}>
                  <Text style={styles.sectionTitle}>{t('notes')}</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    value={receiptDescription}
                    onChangeText={setReceiptDescription}
                    placeholder={t('enterNotes')}
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
  returnSection: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: c.warningTint,
    gap: 8,
  },
  returnedNotice: {
    color: c.warning,
    fontWeight: '600',
    fontSize: 13,
  },
  returnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: c.surface,
    minHeight: 44,
  },
  returnRowText: {
    flex: 1,
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
  },
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
  headerSubtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  receiptCustomerName: {
    marginTop: width * 0.015,
    fontSize: fontSize.sm,
    color: c.textMuted,
    fontWeight: '500',
  },
  refreshButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: c.primary,
  },
  refreshingButton: {
    opacity: 0.6,
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
  receiptsList: {
    flex: 1,
    paddingHorizontal: width * 0.03,
  },
  receiptsContainer: {
    paddingBottom: width * 0.05,
  },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: c.primaryTint,
  },
  archiveToggleText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardArchiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: c.primaryTint,
  },
  cardArchiveText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  expiredWarrantyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: c.warningTint,
  },
  expiredWarrantyText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.warning,
  },
  receiptCard: {
    backgroundColor: c.surface,
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
    backgroundColor: c.surfaceSunken,
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
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.primary,
  },
  receiptDate: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  receiptDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: width * 0.02,
  },
  receiptTotal: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.success,
  },
  receiptItemsCount: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  receiptTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptTimeText: {
    fontSize: fontSize.sm,
    color: c.textSubtle,
  },
  cardShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  cardShareText: {
    color: c.textInverse,
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: width * 0.1,
  },
  emptyStateText: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: c.textMuted,
    marginTop: width * 0.05,
    marginBottom: width * 0.02,
  },
  emptyStateSubtext: {
    fontSize: fontSize.md,
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
    paddingTop: width * 0.12,
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
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.03,
  },
  receiptTitle: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: c.text,
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
  receiptSummaryTotal: {
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
  receiptCustomerSection: {
    marginBottom: width * 0.05,
  },
  customerInput: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: width * 0.025,
    padding: width * 0.03,
    fontSize: fontSize.md,
    color: c.text,
    backgroundColor: c.surface,
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
