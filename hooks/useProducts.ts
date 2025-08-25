import { useState, useEffect } from 'react';
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
          setProducts((prev) => [...prev, payload.new as Product]);
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
          setProducts((prev) =>
            prev.map((product) =>
              product.id === payload.new.id ? (payload.new as Product) : product
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

    setProducts(data || []);
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          name: productData.name,
          brand: productData.brand,
          category: productData.category,
          buying_price: productData.buyingPrice,
          selling_price: productData.sellingPrice,
          pieces: productData.pieces,
          low_stock_alert: productData.lowStockAlert,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding product:', error);
      return null;
    }

    return data;
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
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      return null;
    }

    return data;
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

    return data;
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