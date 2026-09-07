import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

/**
 * Payment rails a Tanzanian counter actually uses. `split` covers part cash /
 * part mobile money; `credit` is the shop's own book debt.
 */
export type PaymentMethod =
  | 'cash'
  | 'mpesa'
  | 'tigopesa'
  | 'airtelmoney'
  | 'halopesa'
  | 'azampesa'
  | 'bank'
  | 'credit'
  | 'split';

export const PAYMENT_METHODS: { value: PaymentMethod; labelKey: string }[] = [
  { value: 'cash', labelKey: 'cashPayment' },
  { value: 'mpesa', labelKey: 'mpesa' },
  { value: 'tigopesa', labelKey: 'tigopesa' },
  { value: 'airtelmoney', labelKey: 'airtelmoney' },
  { value: 'halopesa', labelKey: 'halopesa' },
  { value: 'azampesa', labelKey: 'azampesa' },
  { value: 'bank', labelKey: 'bankTransfer' },
];

/**
 * Warranty terms the till offers. The database accepts any whole number of
 * months up to 120; these are just the buttons a seller actually presses.
 */
export const WARRANTY_OPTIONS = [3, 6, 12] as const;
export type WarrantyMonths = (typeof WARRANTY_OPTIONS)[number];

/**
 * Where a line stands against the term that was promised.
 *
 * `none` covers accessories sold without cover and every line sold before v5,
 * which carry no expiry date at all — those are not "expired", they are simply
 * not under warranty, and must never be reported as lapsed.
 */
export type WarrantyState = 'none' | 'active' | 'expired';

export const warrantyState = (warrantyUntil?: string): WarrantyState => {
  if (!warrantyUntil) return 'none';
  const expiry = new Date(`${warrantyUntil}T23:59:59`);
  if (Number.isNaN(expiry.getTime())) return 'none';
  return expiry.getTime() < Date.now() ? 'expired' : 'active';
};

/** Methods that carry a confirmation code worth storing for disputes. */
export const REFERENCE_METHODS: PaymentMethod[] = [
  'mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'azampesa', 'bank',
];

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  price: number;
  buyingPrice: number;
  productName?: string;
  productBrand?: string;
  productImei?: string;
  /** IMEIs actually handed over, for serialised lines. */
  unitImeis?: string[];
  /** Term the seller chose at the till, in months. */
  warrantyMonths?: number;
  /** Date the promise lapses, as `YYYY-MM-DD`. */
  warrantyUntil?: string;
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
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  loanAmount: number;
  pointsAwarded: number;
  status: 'completed' | 'partially_returned' | 'returned';
  /**
   * Set when the shopkeeper files the receipt away. Presentation only — an
   * archived sale still counts in every report and still answers an IMEI
   * lookup; it is simply out of the way in the receipts list.
   */
  archivedAt?: string;
  created_at: string;
}

/** A cart line on its way to checkout. */
export interface CheckoutItem {
  productId: string;
  quantity: number;
  price: number;
  /** Required for serialised products; one id per unit sold. */
  unitIds?: string[];
  /** Warranty term the seller picked. Omitted falls back to the product's own. */
  warrantyMonths?: number;
}

const mapSaleItem = (item: any): SaleItem => ({
  id: item.id,
  saleId: item.sale_id,
  productId: item.product_id,
  quantity: Number(item.quantity),
  price: Number(item.price),
  buyingPrice: Number(item.buying_price),
  productName: (Array.isArray(item.product) ? item.product[0]?.name : item.product?.name) ?? undefined,
  productBrand: (Array.isArray(item.product) ? item.product[0]?.brand : item.product?.brand) ?? undefined,
  productImei: (Array.isArray(item.product) ? item.product[0]?.imei : item.product?.imei) ?? undefined,
  // `imeis` is the permanent snapshot taken at sale time (v5). The live join
  // is only a fallback for lines sold before it existed — and it goes empty the
  // moment a unit is returned, which is precisely why the snapshot was added.
  unitImeis: Array.isArray(item.imeis) && item.imeis.length
    ? item.imeis
    : Array.isArray(item.units)
      ? item.units.map((u: any) => u.imei).filter(Boolean)
      : undefined,
  warrantyMonths: item.warranty_months ?? undefined,
  warrantyUntil: item.warranty_until ?? undefined,
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
  paymentMethod: (sale.payment_method as PaymentMethod) ?? 'cash',
  paymentReference: sale.payment_reference ?? undefined,
  loanAmount: Number(sale.loan_amount ?? 0),
  archivedAt: sale.archived_at ?? undefined,
  pointsAwarded: Number(sale.points_awarded ?? 0),
  status: sale.status ?? 'completed',
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

  const fetchSales = useCallback(async () => {
    const { data: saleRows, error } = await supabase
      .from('sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sales:', error);
      return;
    }

    if (!saleRows?.length) { setSales([]); return; }

    const { data: itemRows, error: itemError } = await supabase
      .from('sale_items')
      .select('*, product:products(name, brand, imei), units:product_units(imei)')
      .in('sale_id', saleRows.map(sale => sale.id));

    if (itemError) console.error('Error fetching receipt items:', itemError);
    const itemsBySale = new Map<string, SaleItem[]>();
    for (const row of itemRows || []) {
      const item = mapSaleItem(row);
      const current = itemsBySale.get(item.saleId) || [];
      current.push(item);
      itemsBySale.set(item.saleId, current);
    }

    const salesWithItems = saleRows.map(sale => mapSale(sale, itemsBySale.get(sale.id) || []));

    setSales(salesWithItems);
  }, []);

  const fetchSaleWithItems = useCallback(async (saleId: string) => {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single();

    if (saleError) {
      console.error('Error fetching sale:', saleError);
      return null;
    }

    const { data: items, error: itemError } = await supabase
      .from('sale_items')
      .select('*, product:products(name, brand, imei), units:product_units(imei)')
      .eq('sale_id', saleId);

    if (itemError) console.error('Error fetching receipt items:', itemError);
    return mapSale(sale, (items || []).map(mapSaleItem));
  }, []);

  /**
   * Completes a sale through the `complete_sale` RPC, which does stock, loan,
   * IMEI assignment and loyalty in one transaction.
   *
   * Returns a discriminated result rather than null: the database raises
   * specific, translatable messages ("Insufficient stock for Redmi 13C",
   * "One or more selected units are no longer in stock") and the till used to
   * throw them away and show a generic failure.
   */
  const addSale = async (
    saleData: {
      total: number;
      cashReceived: number;
      customer_name?: string;
      paymentMethod?: PaymentMethod;
      paymentReference?: string;
    },
    items: CheckoutItem[],
    customerId?: string,
    loanAmount = 0,
  ): Promise<{ sale: Sale | null; error: string | null }> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { sale: null, error: 'Not signed in' };

    const { data: saleId, error } = await supabase.rpc('complete_sale', {
      p_total: saleData.total,
      p_cash_received: saleData.cashReceived,
      p_items: items,
      p_customer_id: customerId ?? null,
      p_loan_amount: loanAmount,
      p_customer_name: saleData.customer_name ?? null,
      p_payment_method: saleData.paymentMethod ?? 'cash',
      p_payment_reference: saleData.paymentReference ?? null,
    });

    if (error || !saleId) {
      console.error('Error adding sale:', error);
      return { sale: null, error: error?.message ?? 'Sale could not be completed' };
    }

    return { sale: await fetchSaleWithItems(saleId), error: null };
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

  /**
   * Files a receipt away, or brings it back. Never deletes: see migration v6
   * for why a sale outlives the warranty it was sold under.
   */
  const setSaleArchived = async (saleId: string, archived: boolean) => {
    const archivedAt = archived ? new Date().toISOString() : null;
    const { error } = await supabase
      .from('sales')
      .update({ archived_at: archivedAt })
      .eq('id', saleId);

    if (error) {
      console.error('Error archiving sale:', error);
      return { error: error.message };
    }

    setSales(prev => prev.map(sale =>
      sale.id === saleId ? { ...sale, archivedAt: archivedAt ?? undefined } : sale
    ));
    return { error: null };
  };

  /**
   * Sales carrying at least one line whose warranty has lapsed.
   *
   * Surfaced so the shopkeeper knows the shop is no longer on the hook for
   * those handsets. Deliberately not a deletion queue: a sale is a tax record,
   * it backs the profit reports, and it is what the IMEI lookup searches when
   * someone asks whether this shop sold a given device.
   */
  const getExpiredWarrantySales = () =>
    sales.filter(sale => sale.items.some(item => warrantyState(item.warrantyUntil) === 'expired'));

  return {
    sales,
    getExpiredWarrantySales,
    setSaleArchived,
    addSale,
    updateSale,
    getSalesByDate,
    getTodaysSales,
    getTotalSales,
    getSalesCount,
    fetchSales,
  };
}
