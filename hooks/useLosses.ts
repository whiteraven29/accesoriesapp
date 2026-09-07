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
          const loss = {
            ...payload.new,
            productId: payload.new.product_id,
            lossValue: Number(payload.new.loss_value),
          } as Loss;
          setLosses((prev) => [loss, ...prev]);
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
              loss.id === payload.new.id ? ({
                ...payload.new,
                productId: payload.new.product_id,
                lossValue: Number(payload.new.loss_value),
              } as Loss) : loss
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
      lossValue: Number(loss.loss_value),
    }));

    setLosses(mappedLosses);
  };

  /**
   * Records a loss through the `record_loss` RPC.
   *
   * The previous implementation inserted the loss row and never touched stock,
   * so a stolen handset hit the P&L and stayed on the shelf as sellable. The
   * RPC now writes off the stock (or the specific IMEI units) in the same
   * transaction and values the loss at cost.
   */
  const addLoss = async (lossData: {
    productId: string;
    quantity: number;
    reason: string;
    description?: string;
    /** Required when the product is serialised. */
    unitIds?: string[];
  }): Promise<{ id: string | null; error: string | null }> => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return { id: null, error: 'Not signed in' };

    const { data, error } = await supabase.rpc('record_loss', {
      p_product_id: lossData.productId,
      p_quantity: lossData.quantity,
      p_reason: lossData.reason,
      p_description: lossData.description ?? null,
      p_unit_ids: lossData.unitIds ?? null,
    });

    if (error) {
      console.error('Error recording loss:', error);
      return { id: null, error: error.message };
    }

    await fetchLosses();
    return { id: data as string, error: null };
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
