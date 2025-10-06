import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export interface Product {
  imei?: string;
  id: string;
  name: string;
  brand: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  pieces: number;
  lowStockAlert: number;
  created_at: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);

  // Fetch products from Supabase
  useEffect(() => {
    fetchProducts();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          const newProduct = {
            ...payload.new,
            buyingPrice: payload.new.buying_price,
            sellingPrice: payload.new.selling_price,
            lowStockAlert: payload.new.low_stock_alert,
          };
          setProducts((prev) => [...prev, newProduct as Product]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          const updatedProduct = {
            ...payload.new,
            buyingPrice: payload.new.buying_price,
            sellingPrice: payload.new.selling_price,
            lowStockAlert: payload.new.low_stock_alert,
          };
          setProducts((prev) =>
            prev.map((product) =>
              product.id === payload.new.id ? (updatedProduct as Product) : product
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          setProducts((prev) => prev.filter((product) => product.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    // Map database fields to interface fields
    const mappedProducts = (data || []).map(product => ({
      ...product,
      buyingPrice: product.buying_price,
      sellingPrice: product.selling_price,
      lowStockAlert: product.low_stock_alert,
    }));

    setProducts(mappedProducts);
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'created_at'>) => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return null;

    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          user_id: user.user.id,
          name: productData.name,
          brand: productData.brand,
          category: productData.category,
          buying_price: productData.buyingPrice,
          selling_price: productData.sellingPrice,
          pieces: productData.pieces,
          low_stock_alert: productData.lowStockAlert,
          imei: productData.imei, // Include IMEI
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding product:', error);
      return null;
    }

    return {
      ...data,
      buyingPrice: data.buying_price,
      sellingPrice: data.selling_price,
      lowStockAlert: data.low_stock_alert,
    };
  };

  const updateProduct = async (id: string, productData: Omit<Product, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('products')
      .update({
        name: productData.name,
        brand: productData.brand,
        category: productData.category,
        buying_price: productData.buyingPrice,
        selling_price: productData.sellingPrice,
        pieces: productData.pieces,
        low_stock_alert: productData.lowStockAlert,
        imei: productData.imei, // Include IMEI
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return null;
    }

    return {
      ...data,
      buyingPrice: data.buying_price,
      sellingPrice: data.selling_price,
      lowStockAlert: data.low_stock_alert,
    };
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      return false;
    }

    return true;
  };

  const getProductById = (id: string) => {
    return products.find(product => product.id === id);
  };

  const updateProductStock = async (id: string, newStock: number) => {
    const { data, error } = await supabase
      .from('products')
      .update({ pieces: newStock })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product stock:', error);
      return null;
    }

    // Map the returned data to match the interface
    return {
      ...data,
      buyingPrice: data.buying_price,
      sellingPrice: data.selling_price,
      lowStockAlert: data.low_stock_alert,
    };
  };

  return {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    updateProductStock,
    fetchProducts,
  };
}