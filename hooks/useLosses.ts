import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';

export interface Loss {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  description?: string;
  lossValue: number;
  created_at: string;
  product?: {
    id: string;
    name: string;
    brand: string;
  };
}

export function useLosses() {
  const [losses, setLosses] = useState<Loss[]>([]);

  // Fetch losses from Supabase
  useEffect(() => {
    fetchLosses();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('losses-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'losses',
        },
        (payload) => {
          setLosses((prev) => [...prev, payload.new as Loss]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'losses',
        },
        (payload) => {
          setLosses((prev) =>
            prev.map((loss) =>
              loss.id === payload.new.id ? (payload.new as Loss) : loss
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'losses',
        },
        (payload) => {
          setLosses((prev) => prev.filter((loss) => loss.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLosses = async () => {
    const { data, error } = await supabase
      .from('losses')
      .select(`
        *,
        product:products(id, name, brand)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching losses:', error);
      return;
    }

    // Map database fields to interface fields
    const mappedLosses = (data || []).map(loss => ({
      ...loss,
      productId: loss.product_id,
      lossValue: loss.loss_value,
    }));

    setLosses(mappedLosses);
  };

  const addLoss = async (lossData: Omit<Loss, 'id' | 'created_at' | 'product'>) => {
    const { data, error } = await supabase
      .from('losses')
      .insert([
        {
          product_id: lossData.productId,
          quantity: lossData.quantity,
          reason: lossData.reason,
          description: lossData.description,
          loss_value: lossData.lossValue,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error adding loss:', error);
      return null;
    }

    // Fetch the product details
    const { data: product } = await supabase
      .from('products')
      .select('id, name, brand')
      .eq('id', lossData.productId)
      .single();

    // Map the returned data to match the interface
    return {
      ...data,
      productId: data.product_id,
      lossValue: data.loss_value,
      product,
    };
  };

  const updateLoss = async (id: string, lossData: Partial<Omit<Loss, 'id' | 'created_at' | 'product'>>) => {
    const { data, error } = await supabase
      .from('losses')
      .update({
        product_id: lossData.productId,
        quantity: lossData.quantity,
        reason: lossData.reason,
        description: lossData.description,
        loss_value: lossData.lossValue,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating loss:', error);
      return null;
    }

    // Map the returned data to match the interface
    return {
      ...data,
      productId: data.product_id,
      lossValue: data.loss_value,
    };
  };

  const deleteLoss = async (id: string) => {
    const { error } = await supabase
      .from('losses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting loss:', error);
      return false;
    }

    return true;
  };

  const getTotalLossValue = () => {
    return losses.reduce((total, loss) => total + loss.lossValue, 0);
  };

  const getLossesByReason = (reason: string) => {
    return losses.filter(loss => loss.reason === reason);
  };

  return {
    losses,
    addLoss,
    updateLoss,
    deleteLoss,
    getTotalLossValue,
    getLossesByReason,
    fetchLosses,
  };
}