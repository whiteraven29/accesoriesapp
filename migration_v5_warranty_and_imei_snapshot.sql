-- ============================================================================
-- DukaSmart v5 — permanent IMEI record on the receipt, seller-chosen warranty
--
-- Run once in the Supabase SQL editor, after migration_v4_fix_stock_movements.sql.
--
-- WHAT THIS FIXES
--   1. A sold handset's IMEI lived only in `product_units.sale_item_id`. A
--      return sets that column back to null so the unit can re-enter stock,
--      which silently erased the IMEI from the original receipt. The receipt is
--      exactly the document a warranty dispute turns on, so it now carries its
--      own snapshot that nothing downstream can rewrite.
--
--   2. Warranty was hardcoded to 365 days for every serialised product. The
--      seller now picks the term per line at the till — the app offers 3, 6 and
--      12 months — and both the unit and the receipt record what was promised.
--
-- COMPATIBILITY
--   `complete_sale` keeps its existing signature: the term travels inside the
--   `p_items` JSON as `warrantyMonths`. An un-updated client simply omits it and
--   falls back to the product's `warranty_days`, exactly as before. Unlike v3,
--   this migration does not break older clients.
--
-- RETENTION
--   Nothing here deletes a sale. Expired warranties are surfaced to the
--   shopkeeper to act on; sales stay put because they are tax records, they
--   back the profit reports, and they are what the IMEI lookup searches.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Snapshot columns on the receipt line
-- ---------------------------------------------------------------------------
alter table public.sale_items
  add column if not exists imeis text[],
  add column if not exists warranty_months integer,
  add column if not exists warranty_until date;

comment on column public.sale_items.imeis is
  'IMEIs handed over on this line, snapshotted at sale time. Survives a return, unlike product_units.sale_item_id.';
comment on column public.sale_items.warranty_months is
  'Term the seller chose at the till. Null for lines sold before v5, or sold on the product''s own warranty_days.';
comment on column public.sale_items.warranty_until is
  'Date the promise lapses. Snapshotted so it cannot drift if the product record is later edited.';

-- Drives the "warranty expired" list without scanning every sale.
create index if not exists sale_items_warranty_until_idx
  on public.sale_items (user_id, warranty_until)
  where warranty_until is not null;

-- ---------------------------------------------------------------------------
-- 2. Backfill from units still bound to their sale
--
-- Handsets already returned cannot be recovered: the link they would have been
-- read through is the thing this migration exists to stop relying on. Anything
-- still bound is captured permanently here.
-- ---------------------------------------------------------------------------
update public.sale_items si
set imeis = bound.imeis,
    warranty_until = coalesce(si.warranty_until, bound.warranty_until)
from (
  select sale_item_id,
         array_agg(imei order by imei) as imeis,
         max(warranty_until) as warranty_until
  from public.product_units
  where sale_item_id is not null
  group by sale_item_id
) bound
where bound.sale_item_id = si.id
  and si.imeis is null;

-- ---------------------------------------------------------------------------
-- 3. complete_sale: record the chosen term, snapshot the IMEIs
-- ---------------------------------------------------------------------------
create or replace function public.complete_sale(
  p_total numeric,
  p_cash_received numeric,
  p_items jsonb,
  p_customer_id uuid default null,
  p_loan_amount numeric default 0,
  p_customer_name text default null,
  p_payment_method text default 'cash',
  p_payment_reference text default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_sale_item_id uuid;
  v_calculated_total numeric := 0;
  v_quantity integer;
  v_unit_ids uuid[];
  v_locked integer;
  v_warranty_months integer;
  v_warranty_until date;
  v_points integer := 0;
  v_rate integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_total < 0 or p_cash_received < 0 or p_loan_amount < 0 then
    raise exception 'Amounts cannot be negative';
  end if;
  if p_cash_received + p_loan_amount < p_total then
    raise exception 'Payment and loan do not cover the sale total';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must contain at least one item';
  end if;
  if p_loan_amount > 0 and p_customer_id is null then
    raise exception 'A customer is required for a credit sale';
  end if;

  insert into public.sales (
    user_id, total, cash_received, change, customer_name, customer_id,
    payment_method, payment_reference, loan_amount
  )
  values (
    v_user_id,
    p_total,
    p_cash_received,
    greatest(0, p_cash_received - (p_total - p_loan_amount)),
    nullif(trim(p_customer_name), ''),
    p_customer_id,
    coalesce(nullif(trim(p_payment_method), ''), 'cash'),
    nullif(trim(p_payment_reference), ''),
    p_loan_amount
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::integer;

    -- The seller picks the term at the till (3 / 6 / 12 months in the UI).
    -- Absent, the product's own `warranty_days` still applies, so a client that
    -- has not been updated keeps working exactly as before.
    v_warranty_months := nullif(v_item->>'warrantyMonths', '')::integer;

    if v_warranty_months is not null and (v_warranty_months < 0 or v_warranty_months > 120) then
      raise exception 'Warranty must be between 0 and 120 months';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid and user_id = v_user_id
    for update;

    if not found then raise exception 'Product not found'; end if;
    if v_quantity <= 0 then raise exception 'Invalid quantity'; end if;
    if (v_item->>'price')::numeric < 0 then raise exception 'Invalid price'; end if;

    v_warranty_until := case
      when v_warranty_months is not null then
        case
          when v_warranty_months > 0
            then (current_date + make_interval(months => v_warranty_months))::date
          else null
        end
      when v_product.warranty_days > 0 then (current_date + v_product.warranty_days)::date
      else null
    end;

    insert into public.sale_items (
      user_id, sale_id, product_id, quantity, price, buying_price,
      warranty_months, warranty_until
    )
    values (
      v_user_id, v_sale_id, v_product.id, v_quantity,
      (v_item->>'price')::numeric, v_product.buying_price,
      v_warranty_months, v_warranty_until
    )
    returning id into v_sale_item_id;

    v_calculated_total := v_calculated_total + (v_quantity * (v_item->>'price')::numeric);

    if v_product.is_serialized then
      -- A handset leaves the shop as a specific IMEI, never as "one of five".
      select array_agg(value::uuid) into v_unit_ids
      from jsonb_array_elements_text(coalesce(v_item->'unitIds', '[]'::jsonb));

      if v_unit_ids is null or array_length(v_unit_ids, 1) <> v_quantity then
        raise exception 'Select % IMEI unit(s) for %', v_quantity, v_product.name;
      end if;

      -- Lock first: two tills must not sell the same handset. FOR UPDATE
      -- cannot be combined with an aggregate, so count via diagnostics.
      perform 1 from public.product_units
      where id = any(v_unit_ids)
        and user_id = v_user_id
        and product_id = v_product.id
        and status = 'in_stock'
      for update;
      get diagnostics v_locked = row_count;

      if v_locked <> v_quantity then
        raise exception 'One or more selected units are no longer in stock';
      end if;

      update public.product_units
      set status = 'sold',
          sale_item_id = v_sale_item_id,
          sold_at = now(),
          warranty_until = v_warranty_until
      where id = any(v_unit_ids) and user_id = v_user_id;

      -- The receipt keeps its own copy of what was handed over. A return sets
      -- product_units.sale_item_id back to null so the handset can re-enter
      -- stock, which used to erase the IMEI from the original receipt — the
      -- one record a warranty dispute actually turns on.
      update public.sale_items
      set imeis = (
        select array_agg(imei order by imei)
        from public.product_units
        where id = any(v_unit_ids) and user_id = v_user_id
      )
      where id = v_sale_item_id and user_id = v_user_id;
      -- The sync trigger recomputes products.pieces from the remaining units.
    else
      if v_product.pieces < v_quantity then
        raise exception 'Insufficient stock for %', v_product.name;
      end if;

      update public.products
      set pieces = pieces - v_quantity
      where id = v_product.id and user_id = v_user_id;
    end if;
  end loop;

  if round(v_calculated_total, 2) <> round(p_total, 2) then
    raise exception 'Sale total does not match its items';
  end if;

  if p_loan_amount > 0 then
    update public.customers
    set loan_balance = loan_balance + p_loan_amount
    where id = p_customer_id and user_id = v_user_id;

    if not found then raise exception 'Customer not found'; end if;

    insert into public.customer_loan_history (user_id, customer_id, type, amount, description)
    values (v_user_id, p_customer_id, 'loan', p_loan_amount, 'Loan for sale ' || v_sale_id);
  end if;

  -- Loyalty accrual. Previously the column existed and was never written, so
  -- every customer sat at zero points forever.
  if p_customer_id is not null then
    select loyalty_points_per_1000 into v_rate from public.user_profiles where id = v_user_id;
    v_points := floor(p_total / 1000.0) * coalesce(v_rate, 1);

    if v_points > 0 then
      update public.customers
      set loyalty_points = loyalty_points + v_points
      where id = p_customer_id and user_id = v_user_id;

      update public.sales set points_awarded = v_points where id = v_sale_id;
    end if;
  end if;

  return v_sale_id;
end;
$$;

revoke all on function public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text, text, text) from public, anon;
grant execute on function public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
