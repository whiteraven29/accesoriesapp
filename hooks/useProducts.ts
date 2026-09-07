import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  pieces: number;
  lowStockAlert: number;
  /**
   * Handsets are tracked as individual IMEI units in `product_units`; for those
   * rows `pieces` is maintained by a database trigger and must not be written
   * directly.
   */
  isSerialized: boolean;
  warrantyDays: number;
  supplierId?: string;
  /** Legacy single-IMEI column, kept so old rows still display. */
  imei?: string;
  created_at: string;
}

export type ProductInput = Omit<
  Product,
  'id' | 'created_at' | 'isSerialized' | 'warrantyDays' | 'supplierId' | 'imei'
> & {
  isSerialized?: boolean;
  warrantyDays?: number;
  supplierId?: string;
  imei?: string;
};

/**
 * One place that turns a database row into a Product. The previous version
 * repeated this mapping in six places — two realtime handlers, the fetch, and
 * three mutations — which is how `brand` ended up defaulting in some paths and
 * not others.
 */
const mapProduct = (row: any): Product => ({
  id: row.id,
  name: row.name,
  brand: row.brand ?? '',
  category: row.category ?? '',
  buyingPrice: Number(row.buying_price ?? 0),
  sellingPrice: Number(row.selling_price ?? 0),
  pieces: Number(row.pieces ?? 0),
  lowStockAlert: Number(row.low_stock_alert ?? 0),
  isSerialized: Boolean(row.is_serialized),
  warrantyDays: Number(row.warranty_days ?? 0),
  supplierId: row.supplier_id ?? undefined,
  imei: row.imei ?? undefined,
  created_at: row.created_at,
});

const toRow = (input: Partial<ProductInput>) => ({
  ...(input.name !== undefined && { name: input.name }),
  ...(input.brand !== undefined && { brand: input.brand }),
  ...(input.category !== undefined && { category: input.category }),
  ...(input.buyingPrice !== undefined && { buying_price: input.buyingPrice }),
  ...(input.sellingPrice !== undefined && { selling_price: input.sellingPrice }),
  ...(input.lowStockAlert !== undefined && { low_stock_alert: input.lowStockAlert }),
  ...(input.isSerialized !== undefined && { is_serialized: input.isSerialized }),
  ...(input.warrantyDays !== undefined && { warranty_days: input.warrantyDays }),
  ...(input.supplierId !== undefined && { supplier_id: input.supplierId || null }),
  ...(input.imei !== undefined && { imei: input.imei || null }),
});

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
      return;
    }

    setProducts((data || []).map(mapProduct));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();

    // A single subscription for all row events; the previous code registered
    // separate INSERT and UPDATE handlers that each re-implemented the mapping.
    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        setProducts(prev => {
          if (payload.eventType === 'DELETE') {
            return prev.filter(product => product.id !== (payload.old as any).id);
          }

          const next = mapProduct(payload.new);
          const exists = prev.some(product => product.id === next.id);
          return exists
            ? prev.map(product => (product.id === next.id ? next : product))
            : [next, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchProducts]);

  const addProduct = async (
    productData: ProductInput,
  ): Promise<{ product: Product | null; error: string | null }> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { product: null, error: 'Not signed in' };

    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          user_id: user.user.id,
          ...toRow(productData),
          // Serialised stock starts empty: the count comes from registered
          // IMEI units, not from a number typed into the form.
          pieces: productData.isSerialized ? 0 : productData.pieces,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding product:', error);
      return { product: null, error: error.message };
    }
    return { product: mapProduct(data), error: null };
  };

  const updateProduct = async (
    id: string,
    productData: Partial<ProductInput>,
  ): Promise<{ product: Product | null; error: string | null }> => {
    const existing = products.find(product => product.id === id);

    const { data, error } = await supabase
      .from('products')
      .update({
        ...toRow(productData),
        // Never overwrite a trigger-maintained count.
        ...(productData.pieces !== undefined && !existing?.isSerialized
          ? { pieces: productData.pieces }
          : {}),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return { product: null, error: error.message };
    }
    return { product: mapProduct(data), error: null };
  };

  const deleteProduct = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      console.error('Error deleting product:', error);
      return false;
    }
    return true;
  };

  const getProductById = (id: string) => products.find(product => product.id === id);

  const updateProductStock = async (id: string, newStock: number) => {
    const target = products.find(product => product.id === id);
    if (target?.isSerialized) {
      return { product: null, error: 'Serialised stock changes by adding or removing IMEI units' };
    }

    const { data, error } = await supabase
      .from('products')
      .update({ pieces: newStock })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product stock:', error);
      return { product: null, error: error.message };
    }
    return { product: mapProduct(data), error: null };
  };

  const lowStockProducts = products.filter(
    product => !product.isSerialized || product.pieces > 0
      ? product.pieces <= product.lowStockAlert
      : true,
  );

  return {
    products,
    loading,
    lowStockProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    updateProductStock,
    fetchProducts,
  };
}
