import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  price: number;
  buyingPrice: number;
  created_at: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  cashReceived: number;
  change: number;
  customer_name?: string;
  signature?: string;
  description?: string;
  created_at: string;
}

const mapSaleItem = (item: any): SaleItem => ({
  id: item.id,
  saleId: item.sale_id,
  productId: item.product_id,
  quantity: Number(item.quantity),
  price: Number(item.price),
  buyingPrice: Number(item.buying_price),
  created_at: item.created_at,
});

const mapSale = (sale: any, items: SaleItem[] = []): Sale => ({
  id: sale.id,
  items,
  total: Number(sale.total),
  cashReceived: Number(sale.cash_received),
  change: Number(sale.change),
  customer_name: sale.customer_name ?? undefined,
  signature: sale.signature ?? undefined,
  description: sale.description ?? undefined,
  created_at: sale.created_at,
});

export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);

  // Fetch sales from Supabase
  useEffect(() => {
    fetchSales();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('sales-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sales',
        },
        (payload) => {
          // Fetch the full sale with items
          fetchSaleWithItems(payload.new.id).then(sale => {
            if (sale) {
              setSales((prev) => [sale, ...prev]);
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sales',
        },
        (payload) => {
          // Fetch the updated sale with items
          fetchSaleWithItems(payload.new.id).then(sale => {
            if (sale) {
              setSales((prev) =>
                prev.map((s) => (s.id === payload.new.id ? sale : s))
              );
            }
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'sales',
        },
        (payload) => {
          setSales((prev) => prev.filter((sale) => sale.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      return;
    }

    // Fetch items for each sale
    const salesWithItems = await Promise.all(
      (data || []).map(async (sale) => {
        const items = await fetchSaleItems(sale.id);
        return mapSale(sale, items);
      })
    );

    setSales(salesWithItems);
  };

  const fetchSaleItems = async (saleId: string) => {
    const { data, error } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId);

    if (error) {
      console.error('Error fetching sale items:', error);
      return [];
    }

    return (data || []).map(mapSaleItem);
  };

  const fetchSaleWithItems = async (saleId: string) => {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleError) {
      console.error('Error fetching sale:', saleError);
      return null;
    }

    const items = await fetchSaleItems(saleId);
    return mapSale(sale, items);
  };

  const addSale = async (
    saleData: Omit<Sale, 'id' | 'created_at' | 'items'>,
    items: Omit<SaleItem, 'id' | 'saleId' | 'created_at' | 'buyingPrice'>[],
    customerId?: string,
    loanAmount = 0
  ) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;

    const { data: saleId, error } = await supabase.rpc('complete_sale', {
      p_total: saleData.total,
      p_cash_received: saleData.cashReceived,
      p_items: items,
      p_customer_id: customerId ?? null,
      p_loan_amount: loanAmount,
    });

    if (error || !saleId) {
      console.error('Error adding sale:', error);
      return null;
    }

    return fetchSaleWithItems(saleId);
  };

  const getSalesByDate = (date: Date) => {
    return sales.filter(sale => 
      new Date(sale.created_at).toDateString() === date.toDateString()
    );
  };

  const getTodaysSales = () => {
    return getSalesByDate(new Date());
  };

  const getTotalSales = (startDate?: Date, endDate?: Date) => {
    let filteredSales = sales;
    
    if (startDate) {
      filteredSales = filteredSales.filter(sale => new Date(sale.created_at) >= startDate);
    }
    
    if (endDate) {
      filteredSales = filteredSales.filter(sale => new Date(sale.created_at) <= endDate);
    }
    
    return filteredSales.reduce((total, sale) => total + sale.total, 0);
  };

  const updateSale = async (saleId: string, updates: Partial<Pick<Sale, 'customer_name' | 'signature' | 'description'>>) => {
    const { data, error } = await supabase
      .from('sales')
      .update({
        customer_name: updates.customer_name,
        signature: updates.signature,
        description: updates.description,
      })
      .eq('id', saleId)
      .select()
      .single();

    if (error) {
      console.error('Error updating sale:', error);
      return null;
    }

    // Update local state
    setSales(prev => prev.map(sale =>
      sale.id === saleId ? { ...sale, ...updates } : sale
    ));

    return data;
  };

  const getSalesCount = () => {
    return sales.length;
  };

  return {
    sales,
    addSale,
    updateSale,
    getSalesByDate,
    getTodaysSales,
    getTotalSales,
    getSalesCount,
    fetchSales,
  };
}
