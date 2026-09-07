import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export type UnitStatus = 'in_stock' | 'sold' | 'returned' | 'faulty' | 'written_off';
export type UnitCondition = 'new' | 'refurbished' | 'used';

export interface ProductUnit {
  id: string;
  productId: string;
  imei: string;
  imei2?: string;
  serialNumber?: string;
  status: UnitStatus;
  condition: UnitCondition;
  cost: number;
  saleItemId?: string;
  soldAt?: string;
  warrantyUntil?: string;
  notes?: string;
  created_at: string;
  // Joined for the lookup screen.
  productName?: string;
  productBrand?: string;
}

const mapUnit = (row: any): ProductUnit => ({
  id: row.id,
  productId: row.product_id,
  imei: row.imei,
  imei2: row.imei2 ?? undefined,
  serialNumber: row.serial_number ?? undefined,
  status: row.status,
  condition: row.condition,
  cost: Number(row.cost ?? 0),
  saleItemId: row.sale_item_id ?? undefined,
  soldAt: row.sold_at ?? undefined,
  warrantyUntil: row.warranty_until ?? undefined,
  notes: row.notes ?? undefined,
  created_at: row.created_at,
  productName: (Array.isArray(row.product) ? row.product[0]?.name : row.product?.name) ?? undefined,
  productBrand: (Array.isArray(row.product) ? row.product[0]?.brand : row.product?.brand) ?? undefined,
});

/** An IMEI is 15 digits; a 14-digit TAC+serial without the check digit is not one. */
export const isValidImei = (imei: string): boolean => /^\d{15}$/.test(imei.trim());

/**
 * Registers one handset. Standalone so both the inventory screen's unit list
 * and the POS quick-add path share exactly one insert.
 */
export async function createProductUnit(unit: {
  productId: string;
  imei: string;
  imei2?: string;
  cost: number;
  condition?: UnitCondition;
}): Promise<{ unit: ProductUnit | null; error: string | null }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { unit: null, error: 'Not signed in' };

  if (!isValidImei(unit.imei)) return { unit: null, error: 'imeiInvalid' };

  const { data, error } = await supabase
    .from('product_units')
    .insert([
      {
        user_id: user.user.id,
        product_id: unit.productId,
        imei: unit.imei.trim(),
        imei2: unit.imei2?.trim() || null,
        cost: unit.cost,
        condition: unit.condition ?? 'new',
      },
    ])
    .select()
    .single();

  if (error) {
    // 23505 is the per-shop unique index on (user_id, imei).
    return { unit: null, error: error.code === '23505' ? 'imeiAlreadyExists' : error.message };
  }
  return { unit: mapUnit(data), error: null };
}

/**
 * Individual handsets. Serialised stock is what makes warranty claims, police
 * traceability and returns possible — none of which work when five phones share
 * one IMEI field on a product row.
 */
export function useProductUnits(productId?: string) {
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnits = useCallback(async () => {
    if (!productId) {
      setUnits([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('product_units')
      .select('*, product:products(name, brand)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error) console.error('Error fetching units:', error);
    setUnits((data || []).map(mapUnit));
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    if (!productId) return;
    const channel = supabase
      .channel(`product-units-${productId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_units', filter: `product_id=eq.${productId}` },
        () => fetchUnits(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId, fetchUnits]);

  const addUnit = async (unit: {
    productId: string;
    imei: string;
    imei2?: string;
    cost: number;
    condition?: UnitCondition;
  }) => {
    const result = await createProductUnit(unit);
    if (result.unit) await fetchUnits();
    return result;
  };

  const deleteUnit = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('product_units').delete().eq('id', id);
    if (error) {
      console.error('Error deleting unit:', error);
      return false;
    }
    return true;
  };

  const availableUnits = units.filter(unit => unit.status === 'in_stock');

  return { units, availableUnits, loading, fetchUnits, addUnit, deleteUnit };
}

/**
 * Whole-shop IMEI lookup: a customer walks in holding a handset and the shop
 * needs to know whether it sold it, when, to whom, and if it is under warranty.
 */
export async function lookupImei(query: string): Promise<ProductUnit[]> {
  const term = query.trim();
  if (term.length < 4) return [];

  const { data, error } = await supabase
    .from('product_units')
    .select('*, product:products(name, brand)')
    .or(`imei.ilike.%${term}%,imei2.ilike.%${term}%,serial_number.ilike.%${term}%`)
    .limit(25);

  if (error) {
    console.error('IMEI lookup failed:', error);
    return [];
  }
  return (data || []).map(mapUnit);
}

/**
 * Every in-stock handset in the shop, grouped by product.
 *
 * The POS needs this up front: one query beats one-per-product when the cashier
 * is adding items quickly on a slow connection.
 */
export function useAvailableUnits() {
  const [unitsByProduct, setUnitsByProduct] = useState<Record<string, ProductUnit[]>>({});

  const fetchAvailable = useCallback(async () => {
    const { data, error } = await supabase
      .from('product_units')
      .select('*, product:products(name, brand)')
      .eq('status', 'in_stock')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching available units:', error);
      return;
    }

    const grouped: Record<string, ProductUnit[]> = {};
    for (const row of data || []) {
      const unit = mapUnit(row);
      (grouped[unit.productId] ||= []).push(unit);
    }
    setUnitsByProduct(grouped);
  }, []);

  useEffect(() => {
    fetchAvailable();

    const channel = supabase
      .channel('available-units')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_units' }, () =>
        fetchAvailable(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAvailable]);

  return { unitsByProduct, fetchAvailable };
}
