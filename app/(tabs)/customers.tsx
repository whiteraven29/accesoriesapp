import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Users, Plus, Search, CreditCard as Edit, Trash2, CreditCard, DollarSign, User } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { formatCurrency } from '@/utils/currency';
import { useCustomers } from '@/hooks/useCustomers';

export default function CustomersScreen() {
  const { t } = useLanguage();
  const { customers, addCustomer, updateCustomer, deleteCustomer, addLoan, payLoan } = useCustomers();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [loanAmount, setLoanAmount] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, newCustomer);
    } else {
      addCustomer(newCustomer);
    }

    resetForm();
  };

  const resetForm = () => {
    setNewCustomer({
      name: '',
      phone: '',
      email: '',
      address: '',
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
    setShowLoanModal(true);
  };

  const handleLoanSubmit = () => {
    if (!selectedCustomer) return;

    if (loanAmount > 0) {
      addLoan(selectedCustomer.id, loanAmount);
      Alert.alert(t('success'), `Loan of ${formatCurrency(loanAmount)} added`);
    }

    if (paymentAmount > 0) {
      if (paymentAmount > selectedCustomer.loanBalance) {
        Alert.alert(t('error'), 'Payment amount exceeds loan balance');
        return;
      }
      payLoan(selectedCustomer.id, paymentAmount);
      Alert.alert(t('success'), `Payment of ${formatCurrency(paymentAmount)} recorded`);
    }

    setShowLoanModal(false);
    setSelectedCustomer(null);
    setLoanAmount(0);
    setPaymentAmount(0);
  };

  const CustomerCard = ({ customer }: { customer: any }) => {
    const hasLoan = customer.loanBalance > 0;

    return (
      <View style={[styles.customerCard, hasLoan && styles.customerWithLoan]}>
        <View style={styles.customerHeader}>
          <View style={styles.customerAvatar}>
            <User size={24} color="#2563EB" />
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
              onPress={() => handleEditCustomer(customer)}
            >
              <Edit size={16} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleDeleteCustomer(customer.id)}
            >
              <Trash2 size={16} color="#DC2626" />
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
                onPress={() => handleLoan(customer, 'pay')}
              >
                <CreditCard size={16} color="#16A34A" />
                <Text style={styles.loanButtonText}>{t('payLoan')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.loanButton, styles.addLoanButton]}
                onPress={() => handleLoan(customer, 'add')}
              >
                <DollarSign size={16} color="#D97706" />
                <Text style={[styles.loanButtonText, styles.addLoanText]}>{t('addLoan')}</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {!hasLoan && (
            <TouchableOpacity 
              style={styles.addLoanOnlyButton}
              onPress={() => handleLoan(customer, 'add')}
            >
              <DollarSign size={16} color="#2563EB" />
              <Text style={styles.addLoanOnlyText}>{t('addLoan')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('customers')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
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
          <Text style={[styles.statBarValue, { color: '#16A34A' }]}>
            {customers.reduce((total, c) => total + c.loyaltyPoints, 0)}
          </Text>
          <Text style={styles.statBarLabel}>{t('totalPoints')}</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchCustomers')}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <ScrollView style={styles.customersList} showsVerticalScrollIndicator={false}>
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map(customer => (
            <CustomerCard key={customer.id} customer={customer} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Users size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>{t('noCustomers')}</Text>
            <Text style={styles.emptyDescription}>{t('addFirstCustomer')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Customer Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
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
              <Text style={styles.inputLabel}>{t('customerName')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newCustomer.name}
                onChangeText={(text) => setNewCustomer({...newCustomer, name: text})}
                placeholder={t('enterCustomerName')}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('phoneNumber')} *</Text>
              <TextInput
                style={styles.textInput}
                value={newCustomer.phone}
                onChangeText={(text) => setNewCustomer({...newCustomer, phone: text})}
                placeholder={t('enterPhoneNumber')}
                placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
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
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Loan Modal */}
      <Modal visible={showLoanModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLoanModal(false)}>
              <Text style={styles.cancelButton}>{t('cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Loan Management</Text>
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

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Add Loan Amount (TSH)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={loanAmount.toString()}
                    onChangeText={(text) => setLoanAmount(Number(text) || 0)}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Amount (TSH)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={paymentAmount.toString()}
                    onChangeText={(text) => setPaymentAmount(Number(text) || 0)}
                    placeholder="0"
                    keyboardType="numeric"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                {(loanAmount > 0 || paymentAmount > 0) && (
                  <View style={styles.loanCalculation}>
                    <Text style={styles.calculationTitle}>New Balance Calculation</Text>
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
  statBar: {
    flex: 1,
    alignItems: 'center',
  },
  statBarValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  statBarLabel: {
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
  customersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  customerCard: {
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
  customerWithLoan: {
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  customerEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  customerDetails: {
    gap: 12,
  },
  customerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  loanAmount: {
    color: '#D97706',
  },
  loanActions: {
    flexDirection: 'row',
    gap: 12,
  },
  loanButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  addLoanButton: {
    backgroundColor: '#D97706',
  },
  loanButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addLoanText: {
    color: '#FFFFFF',
  },
  addLoanOnlyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EBF4FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  addLoanOnlyText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
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
  customerSummary: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  customerSummaryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  customerSummaryBalance: {
    fontSize: 16,
    color: '#D97706',
    fontWeight: '600',
  },
  loanCalculation: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  newBalance: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
});