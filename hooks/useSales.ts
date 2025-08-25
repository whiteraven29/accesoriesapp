import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  price: number;
  created_at: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  cashReceived: number;
  change: number;
  created_at: string;
}

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
        return { ...sale, items };
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

    return data || [];
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
    return { ...sale, items };
  };

  const addSale = async (saleData: Omit<Sale, 'id' | 'created_at' | 'items'>, items: Omit<SaleItem, 'id' | 'saleId' | 'created_at'>[]) => {
    // First, insert the sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([
        {
          total: saleData.total,
          cash_received: saleData.cashReceived,
          change: saleData.change,
        },
      ])
      .select()
      .single();

    if (saleError) {
      console.error('Error adding sale:', saleError);
      return null;
    }

    // Then, insert the sale items
    const saleItemsData = items.map(item => ({
      sale_id: sale.id,
      product_id: item.productId,
      quantity: item.quantity,
      price: item.price,
    }));

    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItemsData)
      .select();

    if (itemsError) {
      console.error('Error adding sale items:', itemsError);
      return null;
    }

    // Update product stock
    for (const item of items) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('pieces')
        .eq('id', item.productId)
        .single();

      if (!productError && product) {
        await supabase
          .from('products')
          .update({ pieces: product.pieces - item.quantity })
          .eq('id', item.productId);
      }
    }

    return { ...sale, items: saleItems || [] };
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

  const getSalesCount = () => {
    return sales.length;
  };

  return {
    sales,
    addSale,
    getSalesByDate,
    getTodaysSales,
    getTotalSales,
    getSalesCount,
    fetchSales,
  };
}