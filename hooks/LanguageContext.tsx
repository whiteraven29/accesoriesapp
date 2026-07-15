import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Translations {
  [key: string]: string;
}

const translations: { [lang: string]: Translations } = {
  en: {
    // Home
    todaySales: "Today's Sales",
    todayProfit: "Today's Profit",
    totalProducts: 'Total Products',
    totalCustomers: 'Total Customers',
    alerts: 'Alerts',
    lowStock: 'Low Stock Alert',
    itemsLowStock: 'items are low in stock',
    pendingLoans: 'Pending Loans',
    inPendingLoans: 'in pending loans',
    quickActions: 'Quick Actions',
    newSale: 'New Sale',
    addProduct: 'Add Product',
    addCustomer: 'Add Customer',
    viewReports: 'View Reports',

    // Products
    products: 'Products',
    searchProducts: 'Search products...',
    noProducts: 'No Products Found',
    addFirstProduct: 'Add your first product to get started',
    editProduct: 'Edit Product',
    productName: 'Product Name',
    enterProductName: 'Enter product name',
    brand: 'Brand',
    enterBrand: 'Enter brand',
    category: 'Category',
    enterCategory: 'Enter category',
    buyingPrice: 'Buying Price',
    sellingPrice: 'Selling Price',
    pieces: 'Pieces',
    lowStockAlert: 'Low Stock Alert',
    calculations: 'Calculations',
    profitPerUnit: 'Profit per Unit',
    profitMargin: 'Profit Margin',
    totalCost: 'Total Cost',
    profit: 'Profit',
    totalValue: 'Total Value',
    lowStockWarning: 'Low stock warning',
    threshold: 'Threshold',

    // Sales
    pointOfSale: 'Point of Sale',
    cart: 'Cart',
    addToCart: 'Add to Cart',
    removeFromCart: 'Remove from Cart',
    clearCart: 'Clear Cart',
    checkout: 'Checkout',
    total: 'Total',
    subtotal: 'Subtotal',
    cash: 'Cash',
    change: 'Change',
    completeSale: 'Complete Sale',

    // Customers
    customers: 'Customers',
    searchCustomers: 'Search customers...',
    noCustomers: 'No Customers Found',
    addFirstCustomer: 'Add your first customer to get started',
    editCustomer: 'Edit Customer',
    customerName: 'Customer Name',
    enterCustomerName: 'Enter customer name',
    phoneNumber: 'Phone Number',
    enterPhoneNumber: 'Enter phone number',
    email: 'Email',
    enterEmail: 'Enter email address',
    address: 'Address',
    enterAddress: 'Enter address',
    loyaltyPoints: 'Loyalty Points',
    loanBalance: 'Loan Balance',
    payLoan: 'Pay Loan',
    addLoan: 'Add Loan',
    loanHistory: 'Loan History',

    // Reports
    reports: 'Reports & Analytics',
    financialSummary: 'Financial Summary',
    lossInformation: 'Loss Information',
    currentLoss: 'Current loss',
    currentProfit: 'Current profit',
    revenue: 'Revenue',
    cost: 'Cost',
    keyMetrics: 'Key Metrics',
    totalSales: 'Total Sales',
    inventoryValue: 'Inventory Value',
    activeCustomers: 'Active Customers',
    pendingLoansReport: 'Pending Loans',
    lowStockAlertReport: 'Low Stock Alert',
    productPerformance: 'Product Performance',
    customerInsights: 'Customer Insights',
    totalLoyaltyPoints: 'Total Loyalty Points',
    customersWithLoans: 'Customers with Loans',
    averageLoan: 'Average Loan',
    today: 'Today',
    week: 'Week',
    month: 'Month',
    remaining: 'remaining',
    units: 'units',
    items: 'items',

    // Common
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    confirmDelete: 'Confirm Delete',
    confirmDeleteProduct: 'Are you sure you want to delete this product?',
    confirmDeleteCustomer: 'Are you sure you want to delete this customer?',
    fillAllFields: 'Please fill all required fields',
    ok: 'OK',
    home: 'Home', pos: 'POS', receipts: 'Receipts', workspace: 'Business workspace',
    price: 'Price', stock: 'Stock', actions: 'Actions', totalLoans: 'Total Loans', totalPoints: 'Total Points',
    selectCustomer: 'Select Customer', newProduct: 'New product', saveAndAdd: 'Save & add',
    orderSummary: 'Order Summary', payment: 'Payment', customerNameOptional: 'Customer name (optional)',
    enterCustomerReceipt: 'Enter customer name for the receipt', selectCustomerTitle: 'Select Customer',
    done: 'Done', applyDiscount: 'Apply Discount', apply: 'Apply', discountPercentage: 'Discount Percentage (%)',
    saleReceipt: 'Sale Receipt', receiptDetails: 'Receipt Details', receiptsHistory: 'Receipts history',
    searchReceipts: 'Search receipts by ID, date, or amount...', noReceipts: 'No receipts found',
    adjustSearch: 'Try adjusting your search', receiptsAfterSales: 'Receipts will appear here after sales',
    customerInformation: 'Customer Information', cashSaleNoCustomer: 'No Customer (Cash Sale)',
    itemsPurchased: 'Items Purchased', cashReceived: 'Cash Received',
    signature: 'Signature', notes: 'Description/Notes', enterSignature: 'Enter signature',
    enterNotes: 'Add any notes or description', productOutOfStock: 'Product out of stock',
    notEnoughStock: 'Not enough stock available', cartEmpty: 'Cart is empty', insufficientCash: 'Insufficient cash received',
    loan: 'Loan', loanManagement: 'Loan Management', addLoanAmount: 'Add Loan Amount', paymentAmount: 'Payment Amount',
    newBalanceCalculation: 'New Balance Calculation', createAccount: 'Create Account', welcomeBack: 'Welcome Back',
    signIn: 'Sign In', signUp: 'Sign Up', password: 'Password', confirmPassword: 'Confirm Password',
    fullName: 'Full Name', shopName: 'Shop Name', username: 'Username', phone: 'Phone',
    resetPassword: 'Reset Password', updatePassword: 'Update password',
    expenses: 'Expenses', monthlyExpenses: 'This month', addExpense: 'Add Expense', amount: 'Amount',
    description: 'Description', noDescription: 'No description', noExpenses: 'No expenses recorded',
    validExpense: 'Enter a category and an amount greater than zero', expenseSaveFailed: 'Expense could not be saved',
    netProfit: 'Net Profit', operatingExpenses: 'Operating Expenses', inventoryMovements: 'Inventory Movements',
    more: 'More', inventory: 'Inventory', businessTools: 'Business tools and records',
    customerManagement: 'Customer accounts, loyalty and loans', expenseManagement: 'Record and review operating costs',
    shareReceipt: 'Share / PDF',
    allowPopups: 'Allow pop-ups for this site to open the printable receipt',
  },
  sw: {
    // Home
    todaySales: 'Mauzo ya Leo',
    todayProfit: 'Faida ya Leo',
    totalProducts: 'Bidhaa Zote',
    totalCustomers: 'Wateja Wote',
    alerts: 'Arifa',
    lowStock: 'Arifa ya Stock Kidogo',
    itemsLowStock: 'bidhaa zina stock kidogo',
    pendingLoans: 'Mikopo Inayosubiri',
    inPendingLoans: 'katika mikopo inayosubiri',
    quickActions: 'Vitendo vya Haraka',
    newSale: 'Mauzo Mapya',
    addProduct: 'Ongeza Bidhaa',
    addCustomer: 'Ongeza Mteja',
    viewReports: 'Ona Ripoti',

    // Products
    products: 'Bidhaa',
    searchProducts: 'Tafuta bidhaa...',
    noProducts: 'Hakuna Bidhaa',
    addFirstProduct: 'Ongeza bidhaa yako ya kwanza kuanza',
    editProduct: 'Hariri Bidhaa',
    productName: 'Jina la Bidhaa',
    enterProductName: 'Ingiza jina la bidhaa',
    brand: 'Chapa',
    enterBrand: 'Ingiza chapa',
    category: 'Aina',
    enterCategory: 'Ingiza aina',
    buyingPrice: 'Bei ya Ununuzi',
    sellingPrice: 'Bei ya Mauzo',
    pieces: 'Vipande',
    lowStockAlert: 'Arifa ya Stock Kidogo',
    calculations: 'Mahesabu',
    profitPerUnit: 'Faida kwa Kipande',
    profitMargin: 'Uwiano wa Faida',
    totalCost: 'Gharama Jumla',
    profit: 'Faida',
    totalValue: 'Thamani Jumla',
    lowStockWarning: 'Onyo la stock kidogo',
    threshold: 'Kiwango',

    // Sales
    pointOfSale: 'Mahali pa Mauzo',
    cart: 'Kikapu',
    addToCart: 'Weka Kikabuni',
    removeFromCart: 'Ondoa Kikabuni',
    clearCart: 'Safisha Kikapu',
    checkout: 'Maliza Ununuzi',
    total: 'Jumla',
    subtotal: 'Jumla Ndogo',
    cash: 'Pesa Taslimu',
    change: 'Chenji',
    completeSale: 'Maliza Mauzo',

    // Customers
    customers: 'Wateja',
    searchCustomers: 'Tafuta wateja...',
    noCustomers: 'Hakuna Wateja',
    addFirstCustomer: 'Ongeza mteja wako wa kwanza kuanza',
    editCustomer: 'Hariri Mteja',
    customerName: 'Jina la Mteja',
    enterCustomerName: 'Ingiza jina la mteja',
    phoneNumber: 'Nambari ya Simu',
    enterPhoneNumber: 'Ingiza nambari ya simu',
    email: 'Barua Pepe',
    enterEmail: 'Ingiza anwani ya barua pepe',
    address: 'Anwani',
    enterAddress: 'Ingiza anwani',
    loyaltyPoints: 'Alama za Uongozi',
    loanBalance: 'Salio la Mkopo',
    payLoan: 'Lipa Mkopo',
    addLoan: 'Ongeza Mkopo',
    loanHistory: 'Historia ya Mikopo',

    // Reports
    reports: 'Ripoti na Takwimu',
    financialSummary: 'Muhtasari wa Fedha',
    lossInformation: 'Taarifa ya Hasara',
    currentLoss: 'Hasara ya Sasa',
    currentProfit: 'Faida ya Sasa',
    revenue: 'Mapato',
    cost: 'Gharama',
    keyMetrics: 'Vipimo Muhimu',
    totalSales: 'Jumla ya Mauzo',
    inventoryValue: 'Thamani ya Hesabu',
    activeCustomers: 'Wateja Hai',
    pendingLoansReport: 'Mikopo Inayosubiri',
    lowStockAlertReport: 'Arifa ya Stock Kidogo',
    productPerformance: 'Utendaji wa Bidhaa',
    customerInsights: 'Maarifa ya Wateja',
    totalLoyaltyPoints: 'Jumla ya Alama za Uaminifu',
    customersWithLoans: 'Wateja wenye Mikopo',
    averageLoan: 'Wastani wa Mkopo',
    today: 'Leo',
    week: 'Wiki',
    month: 'Mwezi',
    remaining: 'zilizobaki',
    units: 'vipande',
    items: 'bidhaa',

    // Common
    save: 'Hifadhi',
    cancel: 'Ghairi',
    delete: 'Futa',
    edit: 'Hariri',
    add: 'Ongeza',
    search: 'Tafuta',
    filter: 'Chuja',
    sort: 'Panga',
    error: 'Kosa',
    success: 'Mafanikio',
    warning: 'Onyo',
    confirmDelete: 'Thibitisha Kufuta',
    confirmDeleteProduct: 'Una uhakika unataka kufuta bidhaa hii?',
    confirmDeleteCustomer: 'Una uhakika unataka kufuta mteja huyu?',
    fillAllFields: 'Tafadhali jaza vuga vyote vinavyohitajika',
    ok: 'Sawa',
    home: 'Mwanzo', pos: 'Mauzo', receipts: 'Risiti', workspace: 'Eneo la biashara',
    price: 'Bei', stock: 'Stoo', actions: 'Vitendo', totalLoans: 'Jumla ya Mikopo', totalPoints: 'Jumla ya Pointi',
    selectCustomer: 'Chagua Mteja', newProduct: 'Bidhaa mpya', saveAndAdd: 'Hifadhi na ongeza',
    orderSummary: 'Muhtasari wa Oda', payment: 'Malipo', customerNameOptional: 'Jina la mteja (si lazima)',
    enterCustomerReceipt: 'Ingiza jina la mteja kwa ajili ya risiti', selectCustomerTitle: 'Chagua Mteja',
    done: 'Imekamilika', applyDiscount: 'Weka Punguzo', apply: 'Weka', discountPercentage: 'Asilimia ya Punguzo (%)',
    saleReceipt: 'Risiti ya Mauzo', receiptDetails: 'Maelezo ya Risiti', receiptsHistory: 'Historia ya risiti',
    searchReceipts: 'Tafuta kwa namba, tarehe, au kiasi...', noReceipts: 'Hakuna risiti zilizopatikana',
    adjustSearch: 'Jaribu kubadilisha utafutaji', receiptsAfterSales: 'Risiti zitaonekana hapa baada ya mauzo',
    customerInformation: 'Taarifa za Mteja', cashSaleNoCustomer: 'Hakuna Mteja (Mauzo ya Taslimu)',
    itemsPurchased: 'Bidhaa Zilizonunuliwa', cashReceived: 'Fedha Iliyopokelewa',
    signature: 'Sahihi', notes: 'Maelezo ya Ziada', enterSignature: 'Ingiza sahihi',
    enterNotes: 'Ongeza maelezo ya ziada', productOutOfStock: 'Bidhaa imeisha stoo',
    notEnoughStock: 'Idadi iliyopo stoo haitoshi', cartEmpty: 'Kikapu hakina bidhaa', insufficientCash: 'Fedha iliyopokelewa haitoshi',
    loan: 'Mkopo', loanManagement: 'Usimamizi wa Mkopo', addLoanAmount: 'Kiasi cha Kuongeza Mkopo', paymentAmount: 'Kiasi cha Malipo',
    newBalanceCalculation: 'Hesabu ya Salio Jipya', createAccount: 'Fungua Akaunti', welcomeBack: 'Karibu Tena',
    signIn: 'Ingia', signUp: 'Jisajili', password: 'Nenosiri', confirmPassword: 'Thibitisha Nenosiri',
    fullName: 'Jina Kamili', shopName: 'Jina la Duka', username: 'Jina la Mtumiaji', phone: 'Simu',
    resetPassword: 'Weka Upya Nenosiri', updatePassword: 'Badilisha nenosiri',
    expenses: 'Matumizi', monthlyExpenses: 'Mwezi huu', addExpense: 'Ongeza Matumizi', amount: 'Kiasi',
    description: 'Maelezo', noDescription: 'Hakuna maelezo', noExpenses: 'Hakuna matumizi yaliyorekodiwa',
    validExpense: 'Ingiza aina na kiasi kikubwa kuliko sifuri', expenseSaveFailed: 'Matumizi hayakuweza kuhifadhiwa',
    netProfit: 'Faida Halisi', operatingExpenses: 'Matumizi ya Uendeshaji', inventoryMovements: 'Mabadiliko ya Stoo',
    more: 'Zaidi', inventory: 'Stoo', businessTools: 'Zana na kumbukumbu za biashara',
    customerManagement: 'Akaunti, uaminifu na mikopo ya wateja', expenseManagement: 'Rekodi na kagua gharama za uendeshaji',
    shareReceipt: 'Shiriki / PDF',
    allowPopups: 'Ruhusu madirisha ibukizi ili kufungua risiti ya kuchapisha',
  },
};

interface LanguageContextType {
  language: 'en' | 'sw';
  setLanguage: (lang: 'en' | 'sw') => void;
  t: (key: string) => string;
  toggleLanguage: () => void;
  isSwahili: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<'en' | 'sw'>('en');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'sw' : 'en');
  };

  const value = {
    language,
    setLanguage,
    t,
    toggleLanguage,
    isSwahili: language === 'sw',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
