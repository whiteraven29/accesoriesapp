-- ============================================================================
-- DukaSmart v4 — fix: non-serialised sales blocked by RLS
--
-- Run once in the Supabase SQL editor, after migration_v3_market_features.sql.
--
-- SYMPTOM
--   Selling any accessory (or any product not tracked by IMEI) failed with:
--     new row violates row-level security policy for table "stock_movements"
--   Handset sales worked, which is what made this easy to miss.
--
-- CAUSE
--   `stock_movements` has RLS enabled with a SELECT policy only, and its
--   trigger `record_stock_movement()` is SECURITY INVOKER. `complete_sale` is
--   also SECURITY INVOKER, so its `update products set pieces = ...` fired the
--   audit trigger as the shopkeeper — who has no INSERT policy — and the whole
--   transaction aborted.
--
--   Serialised handsets took a different path: their stock is written by
--   `sync_serialized_stock()`, which is SECURITY DEFINER, so the nested audit
--   insert ran privileged and succeeded.
--
-- FIX
--   Make the audit trigger SECURITY DEFINER. Stock movements are a system
--   record, so the system writes them; shopkeepers keep read-only access to
--   their own rows. Deliberately NOT an INSERT policy, which would let a user
--   forge audit entries through the REST API.
-- ============================================================================

begin;

create or replace function public.record_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pieces is distinct from old.pieces then
    insert into public.stock_movements (
      user_id, product_id, quantity_change, stock_before, stock_after, reason
    ) values (
      new.user_id, new.id, new.pieces - old.pieces, old.pieces, new.pieces,
      case when new.pieces > old.pieces then 'restock' else 'stock_out' end
    );
  end if;
  return new;
end;
$$;

-- The audit table is append-only from the application's point of view: reading
-- your own history is allowed, writing it directly is not.
revoke insert, update, delete on public.stock_movements from anon, authenticated;

commit;

notify pgrst, 'reload schema';
