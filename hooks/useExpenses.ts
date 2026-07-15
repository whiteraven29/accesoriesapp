import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description?: string;
  expenseDate: string;
  created_at: string;
}

const mapExpense = (row: any): Expense => ({
  id: row.id,
  category: row.category,
  amount: Number(row.amount),
  description: row.description ?? undefined,
  expenseDate: row.expense_date,
  created_at: row.created_at,
});

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const fetchExpenses = useCallback(async () => {
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
    if (error) { console.error('Error fetching expenses:', error); return; }
    setExpenses((data || []).map(mapExpense));
  }, []);

  useEffect(() => {
    fetchExpenses();
    const channel = supabase.channel('expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, fetchExpenses)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchExpenses]);

  const addExpense = async (expense: Omit<Expense, 'id' | 'created_at'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id, category: expense.category, amount: expense.amount,
      description: expense.description || null, expense_date: expense.expenseDate,
    });
    if (error) { console.error('Error adding expense:', error); return false; }
    await fetchExpenses();
    return true;
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) { console.error('Error deleting expense:', error); return false; }
    setExpenses(current => current.filter(expense => expense.id !== id));
    return true;
  };

  return { expenses, fetchExpenses, addExpense, deleteExpense };
}
