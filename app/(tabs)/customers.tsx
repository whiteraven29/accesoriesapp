import { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, useWindowDimensions } from 'react-native';
import { Users, Plus, Search, CreditCard as Edit, Trash2, CreditCard, DollarSign, User, RefreshCw } from 'lucide-react-native';
import { CONTENT_MAX_WIDTH } from '../../constants/layout';
import { Palette, fontSize, fontWeight, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/LanguageContext';
import { formatCurrency } from '../../utils/currency';
import { useCustomers, ContactType } from '../../hooks/useCustomers';
import { roundMoney } from '../../utils/calculations';

/**
 * Customer row. Hoisted out of the screen body: as a nested declaration React
 * saw a new component type each render and remounted every card in the list.
 */
function CustomerCard({
  customer,
  styles,
  c,
  t,
  onEdit,
  onDelete,
  onLoan,
}: {
  customer: any;
  styles: ReturnType<typeof createStyles>;
  c: Palette;
  t: (key: string) => string;
  onEdit: (customer: any) => void;
  onDelete: (id: string) => void;
  onLoan: (customer: any, mode: 'pay' | 'add') => void;
}) {
  const hasLoan = customer.loanBalance > 0;

  return (
    <View style={[styles.customerCard, hasLoan && styles.customerWithLoan]}>
      <View style={styles.customerHeader}>
        <View style={styles.customerAvatar}>
          <User size={20} color={c.primary} />
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{customer.name}</Text>
          <Text style={styles.customerPhone}>{customer.phone}</Text>
          {customer.email && (
            <Text style={styles.customerEmail}>{customer.email}</Text>
          )}
        </View>
        <View style={styles.customerActions}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => onEdit(customer)}
          >
            <Edit size={16} color={c.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => onDelete(customer.id)}
          >
            <Trash2 size={16} color={c.danger} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.customerDetails}>
        <View style={styles.customerStats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('loyaltyPoints')}</Text>
            <Text style={styles.statValue}>{customer.loyaltyPoints}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('loanBalance')}</Text>
            <Text style={[styles.statValue, hasLoan && styles.loanAmount]}>
              {formatCurrency(customer.loanBalance)}
            </Text>
          </View>
        </View>
        
        {hasLoan && (
          <View style={styles.loanActions}>
            <TouchableOpacity 
              style={styles.loanButton}
              onPress={() => onLoan(customer, 'pay')}
            >
              <CreditCard size={16} color={c.success} />
              <Text style={styles.loanButtonText}>{t('payLoan')}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.loanButton, styles.addLoanButton]}
              onPress={() => onLoan(customer, 'add')}
            >
              <DollarSign size={16} color={c.warning} />
              <Text style={[styles.loanButtonText, styles.addLoanText]}>{t('addLoan')}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {!hasLoan && (
          <TouchableOpacity 
            style={styles.addLoanOnlyButton}
            onPress={() => onLoan(customer, 'add')}
          >
            <DollarSign size={16} color={c.primary} />
            <Text style={styles.addLoanOnlyText}>{t('addLoan')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function CustomersScreen() {
  const { t } = useLanguage();
  const { colors: c } = useTheme();
  const { customers, addCustomer, updateCustomer, deleteCustomer, addLoan, payLoan, fetchCustomers } = useCustomers();
  const { width } = useWindowDimensions();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [loanAction, setLoanAction] = useState<'add' | 'pay'>('add');
  const [refreshing, setRefreshing] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    contactType: 'customer' as ContactType,
  });
  /** Which side of the book to show: walk-in buyers, or the winga. */
  const [typeFilter, setTypeFilter] = useState<ContactType>('customer');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCustomers();
    } catch (error) {
      console.error('Error refreshing customers:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCustomers]);

  const filteredCustomers = customers.filter(customer =>
    (customer.contactType ?? 'customer') === typeFilter &&
    (customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const countOfType = (type: ContactType) =>
    customers.filter(customer => (customer.contactType ?? 'customer') === type).length;

  const handleSaveCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    const saved = editingCustomer
      ? await updateCustomer(editingCustomer.id, newCustomer)
      : await addCustomer(newCustomer);

    if (!saved) {
      Alert.alert(t('error'), 'Customer could not be saved.');
      return;
    }

    resetForm();
  };

  const resetForm = () => {
    setNewCustomer({
      name: '',
      phone: '',
      email: '',
      address: '',
      // A new contact defaults to whichever list is being viewed.
      contactType: typeFilter,
    });
    setEditingCustomer(null);
    setShowAddModal(false);
  };

  const handleEditCustomer = (customer: any) => {
    setNewCustomer({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      contactType: (customer.contactType as ContactType) ?? 'customer',
    });
    setEditingCustomer(customer);
    setShowAddModal(true);
  };

  const handleDeleteCustomer = (customerId: string) => {
    Alert.alert(
      t('confirmDelete'),
      t('confirmDeleteCustomer'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => deleteCustomer(customerId) },
      ]
    );
  };

  const handleLoan = (customer: any, type: 'add' | 'pay') => {
    setSelectedCustomer(customer);
    setLoanAmount(0);
    setPaymentAmount(0);
    setLoanAction(type);
    setShowLoanModal(true);
  };

  const handleLoanSubmit = async () => {
    if (!selectedCustomer) return;
    const amount = loanAction === 'add' ? loanAmount : paymentAmount;
    if (amount <= 0) {
      Alert.alert(t('error'), 'Enter an amount greater than zero.');
      return;
    }

    if (loanAction === 'add' && loanAmount > 0) {
      const result = await addLoan(selectedCustomer.id, loanAmount);
      if (result === null) { Alert.alert(t('error'), 'Loan could not be recorded.'); return; }
      Alert.alert(t('success'), `Loan of ${formatCurrency(loanAmount)} added`);
    }

    if (loanAction === 'pay' && paymentAmount > 0) {
      if (paymentAmount > selectedCustomer.loanBalance) {
        Alert.alert(t('error'), 'Payment amount exceeds loan balance');
        return;
      }
      const result = await payLoan(selectedCustomer.id, paymentAmount);
      if (result === null) { Alert.alert(t('error'), 'Payment could not be recorded.'); return; }
      Alert.alert(t('success'), `Payment of ${formatCurrency(paymentAmount)} recorded`);
    }

    setShowLoanModal(false);
    setSelectedCustomer(null);
    setLoanAmount(0);
    setPaymentAmount(0);
  };



  const styles = useMemo(() => createStyles(width, c), [width, c]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('customers')}</Text>
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
        <View style={styles.statBar}>
          <Text style={styles.statBarValue}>{customers.length}</Text>
          <Text style={styles.statBarLabel}>{t('totalCustomers')}</Text>
        </View>
        <View style={styles.statBar}>
          <Text style={styles.statBarValue}>
            {formatCurrency(customers.reduce((total, c) => total + c.loanBalance, 0))}
          </Text>
          <Text style={styles.statBarLabel}>{t('totalLoans')}</Text>
        </View>
        <View style={styles.statBar}>
          <Text style={[styles.statBarValue, { color: c.success }]}>
            {customers.reduce((total, c) => total + c.loyaltyPoints, 0)}
          </Text>
          <Text style={styles.statBarLabel}>{t('totalPoints')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={c.textSubtle} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchCustomers')}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={c.textSubtle}
        />
      </View>

      <View style={styles.typeFilterRow}>
        {(['customer', 'winga'] as ContactType[]).map(option => {
          const active = typeFilter === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => setTypeFilter(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                {(option === 'winga' ? t('winga') : t('walkInCustomer'))} ({countOfType(option)})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={[styles.customersList, styles.contentColumn]} showsVerticalScrollIndicator={false}>
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map(customer => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              styles={styles}
              c={c}
              t={t}
              onEdit={handleEditCustomer}
              onDelete={handleDeleteCustomer}
              onLoan={handleLoan}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Users size={48} color={c.textSubtle} />
            <Text style={styles.emptyTitle}>{t('noCustomers')}</Text>
            <Text style={styles.emptyDescription}>{t('addFirstCustomer')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Customer Modal */}
      <Modal visible={showAddModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={resetForm}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCustomer ? t('editCustomer') : t('addCustomer')}
            </Text>
            <TouchableOpacity onPress={handleSaveCustomer}>
              <Text style={styles.saveButton}>{t('save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('contactType')} *</Text>
              <View style={styles.typeRow}>
                {(['customer', 'winga'] as ContactType[]).map(option => {
                  const active = newCustomer.contactType === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[styles.typeChip, active && styles.typeChipActive]}
                      onPress={() => setNewCustomer({ ...newCustomer, contactType: option })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                        {option === 'winga' ? t('winga') : t('walkInCustomer')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('customerName')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newCustomer.name}
                onChangeText={(text) => setNewCustomer({...newCustomer, name: text})}
                placeholder={t('enterCustomerName')}
                placeholderTextColor={c.textSubtle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('phoneNumber')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newCustomer.phone}
                onChangeText={(text) => setNewCustomer({...newCustomer, phone: text})}
                placeholder={t('enterPhoneNumber')}
                placeholderTextColor={c.textSubtle}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('email')}</Text>
              <TextInput
                style={styles.textInput}
                value={newCustomer.email}
                onChangeText={(text) => setNewCustomer({...newCustomer, email: text})}
                placeholder={t('enterEmail')}
                placeholderTextColor={c.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('address')}</Text>
              <TextInput
                style={styles.textInput}
                value={newCustomer.address}
                onChangeText={(text) => setNewCustomer({...newCustomer, address: text})}
                placeholder={t('enterAddress')}
                placeholderTextColor={c.textSubtle}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
        </View>
      </Modal>

      {/* Loan Modal */}
      <Modal visible={showLoanModal} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLoanModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('loanManagement')}</Text>
            <TouchableOpacity onPress={handleLoanSubmit}>
              <Text style={styles.saveButton}>{t('save')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedCustomer && (
              <>
                <View style={styles.customerSummary}>
                  <Text style={styles.customerSummaryName}>{selectedCustomer.name}</Text>
                  <Text style={styles.customerSummaryBalance}>
                    Current Balance: {formatCurrency(selectedCustomer.loanBalance)}
                  </Text>
                </View>

                {loanAction === 'add' && <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('addLoanAmount')} (TSH)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={loanAmount.toString()}
                    onChangeText={(text) => setLoanAmount(roundMoney(Number(text.replace(/[^0-9]/g, ''))))}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={c.textSubtle}
                  />
                </View>}

                {loanAction === 'pay' && <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('paymentAmount')} (TSH)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={paymentAmount.toString()}
                    onChangeText={(text) => setPaymentAmount(roundMoney(Number(text.replace(/[^0-9]/g, ''))))}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor={c.textSubtle}
                  />
                </View>}

                {(loanAmount > 0 || paymentAmount > 0) && (
                  <View style={styles.loanCalculation}>
                    <Text style={styles.calculationTitle}>{t('newBalanceCalculation')}</Text>
                    <Text>Current: {formatCurrency(selectedCustomer.loanBalance)}</Text>
                    {loanAmount > 0 && <Text>+ Loan: {formatCurrency(loanAmount)}</Text>}
                    {paymentAmount > 0 && <Text>- Payment: {formatCurrency(paymentAmount)}</Text>}
                    <Text style={styles.newBalance}>
                      New Balance: {formatCurrency(selectedCustomer.loanBalance + loanAmount - paymentAmount)}
                    </Text>
                  </View>
                )}
              </>
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
    backgroundColor: c.danger,
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
  statBar: {
    flex: 1,
    alignItems: 'center',
  },
  statBarValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
  },
  statBarLabel: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginTop: width * 0.005,
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: c.primaryTint,
  },
  typeChipActive: {
    backgroundColor: c.primary,
  },
  typeChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  typeChipTextActive: {
    color: c.textInverse,
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
  customersList: {
    flex: 1,
    paddingHorizontal: width * 0.03,
  },
  customerCard: {
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
  customerWithLoan: {
    borderLeftWidth: width * 0.01,
    borderLeftColor: c.warning,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: width * 0.025,
  },
  customerAvatar: {
    width: width * 0.12,
    height: width * 0.12,
    borderRadius: width * 0.06,
    backgroundColor: c.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: width * 0.03,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.005,
  },
  customerPhone: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  customerEmail: {
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  customerActions: {
    flexDirection: 'row',
    gap: width * 0.02,
  },
  actionButton: {
    padding: width * 0.02,
    borderRadius: width * 0.02,
    backgroundColor: c.surfaceSunken,
  },
  customerDetails: {
    gap: width * 0.025,
  },
  customerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    marginBottom: width * 0.01,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
  },
  loanAmount: {
    color: c.warning,
  },
  loanActions: {
    flexDirection: 'row',
    gap: width * 0.025,
  },
  loanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.success,
    paddingVertical: width * 0.02,
    paddingHorizontal: width * 0.03,
    borderRadius: width * 0.02,
    gap: width * 0.01,
  },
  addLoanButton: {
    backgroundColor: c.warning,
  },
  loanButtonText: {
    color: c.textInverse,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  addLoanText: {
    color: c.textInverse,
  },
  addLoanOnlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primaryTint,
    paddingVertical: width * 0.02,
    paddingHorizontal: width * 0.03,
    borderRadius: width * 0.02,
    gap: width * 0.01,
  },
  addLoanOnlyText: {
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
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
  customerSummary: {
    backgroundColor: c.surfaceSunken,
    padding: width * 0.03,
    borderRadius: width * 0.025,
    marginBottom: width * 0.03,
  },
  customerSummaryName: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.01,
  },
  customerSummaryBalance: {
    fontSize: fontSize.md,
    color: c.warning,
    fontWeight: '600',
  },
  loanCalculation: {
    backgroundColor: c.surfaceSunken,
    padding: width * 0.03,
    borderRadius: width * 0.025,
    marginTop: width * 0.03,
  },
  calculationTitle: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.text,
    marginBottom: width * 0.02,
  },
  newBalance: {
    fontSize: fontSize.md,
    fontWeight: 'bold',
    color: c.primary,
    marginTop: width * 0.02,
    paddingTop: width * 0.02,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  });
};
