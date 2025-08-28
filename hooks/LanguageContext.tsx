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