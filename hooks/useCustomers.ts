import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  loyaltyPoints: number;
  loanBalance: number;
  created_at: string;
}

export interface LoanTransaction {
  id: string;
  customerId: string;
  type: 'loan' | 'payment';
  amount: number;
  description?: string;
  created_at: string;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Fetch customers from Supabase
  useEffect(() => {
    fetchCustomers();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customers',
        },
        (payload) => {
          setCustomers((prev) => [...prev, payload.new as Customer]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers',
        },
        (payload) => {
          setCustomers((prev) =>
            prev.map((customer) =>
              customer.id === payload.new.id ? (payload.new as Customer) : customer
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'customers',
        },
        (payload) => {
          setCustomers((prev) => prev.filter((customer) => customer.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      return;
    }

    setCustomers(data || []);
  };

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'loyaltyPoints' | 'loanBalance' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          name: customerData.name,
          phone: customerData.phone,
          email: customerData.email,
          address: customerData.address,
          loyalty_points: 0,
          loan_balance: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding customer:', error);
      return null;
    }

    return data;
  };

  const updateCustomer = async (id: string, customerData: Partial<Omit<Customer, 'id' | 'created_at'>>) => {
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: customerData.name,
        phone: customerData.phone,
        email: customerData.email,
        address: customerData.address,
        loyalty_points: customerData.loyaltyPoints,
        loan_balance: customerData.loanBalance,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      return null;
    }

    return data;
  };

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting customer:', error);
      return false;
    }

    return true;
  };

  const addLoan = async (customerId: string, amount: number, description?: string) => {
    // First, get the current customer to get their current loan balance
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('loan_balance')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return null;
    }

    // Update customer's loan balance
    const newLoanBalance = customer.loan_balance + amount;
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({ loan_balance: newLoanBalance })
      .eq('id', customerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating customer loan balance:', updateError);
      return null;
    }

    // Add loan transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('customer_loan_history')
      .insert([
        {
          customer_id: customerId,
          type: 'loan',
          amount: amount,
          description: description,
        },
      ])
      .select()
      .single();

    if (transactionError) {
      console.error('Error adding loan transaction:', transactionError);
      return null;
    }

    return { customer: updatedCustomer, transaction };
  };

  const payLoan = async (customerId: string, amount: number, description?: string) => {
    // First, get the current customer to get their current loan balance
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('loan_balance')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return null;
    }

    // Update customer's loan balance (can't go below 0)
    const newLoanBalance = Math.max(0, customer.loan_balance - amount);
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({ loan_balance: newLoanBalance })
      .eq('id', customerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating customer loan balance:', updateError);
      return null;
    }

    // Add payment transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('customer_loan_history')
      .insert([
        {
          customer_id: customerId,
          type: 'payment',
          amount: amount,
          description: description,
        },
      ])
      .select()
      .single();

    if (transactionError) {
      console.error('Error adding payment transaction:', transactionError);
      return null;
    }

    return { customer: updatedCustomer, transaction };
  };

  const addLoyaltyPoints = async (customerId: string, points: number) => {
    // First, get the current customer to get their current loyalty points
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return null;
    }

    // Update customer's loyalty points
    const newLoyaltyPoints = customer.loyalty_points + points;
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({ loyalty_points: newLoyaltyPoints })
      .eq('id', customerId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating customer loyalty points:', updateError);
      return null;
    }

    return updatedCustomer;
  };

  const getCustomerById = (id: string) => {
    return customers.find(customer => customer.id === id);
  };

  const getCustomerLoanHistory = async (customerId: string) => {
    const { data, error } = await supabase
      .from('customer_loan_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer loan history:', error);
      return [];
    }

    return data || [];
  };

  return {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addLoan,
    payLoan,
    addLoyaltyPoints,
    getCustomerById,
    getCustomerLoanHistory,
    fetchCustomers,
  };
}