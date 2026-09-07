import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export interface SaleReturn {
  id: string;
  saleId: string;
  saleItemId?: string;
  productId?: string;
  quantity: number;
  refundAmount: number;
  reason: string;
  restock: boolean;
  created_at: string;
  productName?: string;
}

const mapReturn = (row: any): SaleReturn => ({
  id: row.id,
  saleId: row.sale_id,
  saleItemId: row.sale_item_id ?? undefined,
  productId: row.product_id ?? undefined,
  quantity: Number(row.quantity),
  refundAmount: Number(row.refund_amount),
  reason: row.reason,
  restock: row.restock,
  created_at: row.created_at,
  productName: (Array.isArray(row.product) ? row.product[0]?.name : row.product?.name) ?? undefined,
});

/**
 * Returns and refunds. Phones come back — under warranty, faulty, or simply
 * swapped — and the app previously had no way to reverse a sale at all.
 */
export function useReturns() {
  const [returns, setReturns] = useState<SaleReturn[]>([]);

  const fetchReturns = useCallback(async () => {
    const { data, error } = await supabase
      .from('sale_returns')
      .select('*, product:products(name)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('Error fetching returns:', error);
      return;
    }
    setReturns((data || []).map(mapReturn));
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  /**
   * `restock: false` sends the unit back as faulty rather than sellable — the
   * distinction that keeps a broken handset off the shelf.
   */
  const processReturn = async (input: {
    saleItemId: string;
    quantity: number;
    reason: string;
    restock: boolean;
    unitIds?: string[];
  }): Promise<{ id: string | null; error: string | null }> => {
    const { data, error } = await supabase.rpc('process_return', {
      p_sale_item_id: input.saleItemId,
      p_quantity: input.quantity,
      p_reason: input.reason,
      p_restock: input.restock,
      p_unit_ids: input.unitIds ?? null,
    });

    if (error) {
      console.error('Error processing return:', error);
      return { id: null, error: error.message };
    }

    await fetchReturns();
    return { id: data as string, error: null };
  };

  const totalRefunded = (since?: Date) =>
    returns
      .filter(entry => !since || new Date(entry.created_at) >= since)
      .reduce((sum, entry) => sum + entry.refundAmount, 0);

  return { returns, fetchReturns, processReturn, totalRefunded };
}
