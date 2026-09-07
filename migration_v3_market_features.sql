-- ============================================================================
-- DukaSmart v3 — Tanzanian phone-market features
--
-- Run once in the Supabase SQL editor, after supabase-schema.sql and
-- new_update.sql. Every statement is idempotent, so re-running is safe.
--
-- Adds:
--   1. Per-unit IMEI tracking (a phone is a serialised item, not a quantity)
--   2. Mobile money payment capture (M-Pesa, Mixx by Yas, Airtel Money, ...)
--   3. Losses that actually reduce stock
--   4. Returns and refunds
--   5. Loyalty points that are earned rather than decorative
--   6. Suppliers and costed restocking
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phone text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'suppliers' and policyname = 'Users manage their own suppliers') then
    create policy "Users manage their own suppliers" on public.suppliers
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Product flags for serialised stock
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists is_serialized boolean not null default false,
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists warranty_days integer not null default 0 check (warranty_days >= 0);

comment on column public.products.is_serialized is
  'True for handsets: stock is tracked as individual IMEI units, and products.pieces is maintained by trigger.';

-- NOTE: existing products are deliberately NOT converted here.
--
-- Flipping a live shop's phones to serialised would leave each one claiming its
-- old piece count with no IMEI units behind it: the shelf would read "5 in
-- stock" while checkout refused to sell more than the units registered. Stock
-- you already have keeps working exactly as before, and you convert a product
-- once you have registered a real IMEI for every unit on the shelf — see
-- `convert_product_to_serialized` at the end of this file.
--
-- Products created as Phones from here on are serialised from birth, when the
-- count is zero and there is nothing to lose.

-- ---------------------------------------------------------------------------
-- 3. product_units — one row per physical handset
--
-- This replaces the single `products.imei` text column, which forced a shop
-- either to create a separate product row per handset or to sell five phones
-- all stamped with one IMEI on the receipt.
-- ---------------------------------------------------------------------------
create table if not exists public.product_units (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  imei text not null,
  -- Second IMEI slot: dual-SIM handsets are the norm in this market.
  imei2 text,
  serial_number text,
  status text not null default 'in_stock'
    check (status in ('in_stock', 'sold', 'returned', 'faulty', 'written_off')),
  condition text not null default 'new' check (condition in ('new', 'refurbished', 'used')),
  -- Cost is captured per unit: the same model bought in two batches at two
  -- prices must report two different margins.
  cost numeric not null default 0 check (cost >= 0),
  supplier_id uuid references public.suppliers(id) on delete set null,
  sale_item_id uuid references public.sale_items(id) on delete set null,
  sold_at timestamptz,
  warranty_until date,
  notes text,
  created_at timestamptz not null default now()
);

-- An IMEI is globally unique in the real world; scope the constraint per shop
-- so two tenants can each hold their own record of a handset that changed hands.
create unique index if not exists product_units_user_imei_key
  on public.product_units (user_id, imei);
create index if not exists product_units_product_status_idx
  on public.product_units (product_id, status);
-- Supports the IMEI lookup screen without a sequential scan.
create index if not exists product_units_imei_trgm_idx
  on public.product_units (user_id, imei text_pattern_ops);

alter table public.product_units enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'product_units' and policyname = 'Users manage their own product units') then
    create policy "Users manage their own product units" on public.product_units
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end;
$$;

-- Backfill: carry any existing single IMEI across as one unit.
insert into public.product_units (user_id, product_id, imei, status, cost)
select p.user_id, p.id, p.imei, 'in_stock', p.buying_price
from public.products p
where p.imei is not null
  and trim(p.imei) <> ''
  and not exists (
    select 1 from public.product_units u where u.user_id = p.user_id and u.imei = p.imei
  );

-- ---------------------------------------------------------------------------
-- 4. Keep products.pieces authoritative for serialised products
--
-- For a serialised product the piece count is a derived value: however many
-- units are still in stock. Writing it by hand is what let losses and sales
-- drift apart.
-- ---------------------------------------------------------------------------
create or replace function public.sync_serialized_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
  v_count integer;
begin
  select count(*) into v_count
  from public.product_units
  where product_id = v_product_id and status = 'in_stock';

  update public.products
  set pieces = v_count
  where id = v_product_id and is_serialized = true;

  return null;
end;
$$;

drop trigger if exists product_units_sync_stock on public.product_units;
create trigger product_units_sync_stock
after insert or update of status or delete on public.product_units
for each row execute function public.sync_serialized_stock();

-- ---------------------------------------------------------------------------
-- 5. Payment capture on sales
-- ---------------------------------------------------------------------------
alter table public.sales
  add column if not exists payment_method text not null default 'cash',
  add column if not exists payment_reference text,
  add column if not exists loan_amount numeric not null default 0 check (loan_amount >= 0),
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists status text not null default 'completed'
    check (status in ('completed', 'partially_returned', 'returned')),
  add column if not exists points_awarded integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_payment_method_check'
  ) then
    alter table public.sales add constraint sales_payment_method_check
      check (payment_method in (
        'cash', 'mpesa', 'tigopesa', 'airtelmoney', 'halopesa', 'azampesa', 'bank', 'credit', 'split'
      ));
  end if;
end;
$$;

comment on column public.sales.payment_method is
  'cash | mpesa | tigopesa (Mixx by Yas) | airtelmoney | halopesa | azampesa | bank | credit | split';
comment on column public.sales.payment_reference is
  'Mobile money confirmation code, so a disputed payment can be traced.';

create index if not exists sales_user_created_idx on public.sales (user_id, created_at desc);
create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

-- ---------------------------------------------------------------------------
-- 6. Loyalty configuration
-- ---------------------------------------------------------------------------
alter table public.user_profiles
  add column if not exists loyalty_points_per_1000 integer not null default 1
    check (loyalty_points_per_1000 >= 0),
  add column if not exists currency text not null default 'TZS',
  add column if not exists receipt_footer text;

commit;

-- ============================================================================
-- Transactional operations
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- complete_sale v3
--
-- Adds payment method/reference, IMEI unit assignment and loyalty accrual to
-- the existing atomic checkout. Items may carry a `unitIds` array; it is
-- required for serialised products and must match the line quantity.
-- ---------------------------------------------------------------------------
drop function if exists public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text);
drop function if exists public.complete_sale(numeric, numeric, jsonb, uuid, numeric);

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

    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid and user_id = v_user_id
    for update;

    if not found then raise exception 'Product not found'; end if;
    if v_quantity <= 0 then raise exception 'Invalid quantity'; end if;
    if (v_item->>'price')::numeric < 0 then raise exception 'Invalid price'; end if;

    insert into public.sale_items (user_id, sale_id, product_id, quantity, price, buying_price)
    values (
      v_user_id, v_sale_id, v_product.id, v_quantity,
      (v_item->>'price')::numeric, v_product.buying_price
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
          warranty_until = case
            when v_product.warranty_days > 0
              then (current_date + v_product.warranty_days)
            else null
          end
      where id = any(v_unit_ids) and user_id = v_user_id;
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

-- ---------------------------------------------------------------------------
-- record_loss
--
-- The old client-side addLoss inserted a loss row and never touched stock, so a
-- stolen handset hit the P&L and stayed on the shelf as sellable.
-- ---------------------------------------------------------------------------
create or replace function public.record_loss(
  p_product_id uuid,
  p_quantity integer,
  p_reason text,
  p_description text default null,
  p_unit_ids uuid[] default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_loss_id uuid;
  v_value numeric;
  v_locked integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;

  select * into v_product from public.products
  where id = p_product_id and user_id = v_user_id for update;
  if not found then raise exception 'Product not found'; end if;

  -- Losses are valued at cost, not at the shelf price.
  v_value := v_product.buying_price * p_quantity;

  if v_product.is_serialized then
    if p_unit_ids is null or array_length(p_unit_ids, 1) <> p_quantity then
      raise exception 'Select % IMEI unit(s) to write off', p_quantity;
    end if;

    perform 1 from public.product_units
    where id = any(p_unit_ids) and user_id = v_user_id
      and product_id = p_product_id and status = 'in_stock'
    for update;
    get diagnostics v_locked = row_count;

    if v_locked <> p_quantity then
      raise exception 'One or more selected units are no longer in stock';
    end if;

    update public.product_units
    set status = 'written_off',
        notes = concat_ws(' | ', notes, p_reason)
    where id = any(p_unit_ids) and user_id = v_user_id;
  else
    if v_product.pieces < p_quantity then
      raise exception 'Cannot write off more than the stock on hand';
    end if;

    update public.products set pieces = pieces - p_quantity
    where id = p_product_id and user_id = v_user_id;
  end if;

  insert into public.losses (user_id, product_id, quantity, reason, description, loss_value)
  values (v_user_id, p_product_id, p_quantity, p_reason, p_description, v_value)
  returning id into v_loss_id;

  return v_loss_id;
end;
$$;

revoke all on function public.record_loss(uuid, integer, text, text, uuid[]) from public, anon;
grant execute on function public.record_loss(uuid, integer, text, text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Returns and refunds
-- ---------------------------------------------------------------------------
create table if not exists public.sale_returns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  sale_id uuid references public.sales(id) on delete cascade not null,
  sale_item_id uuid references public.sale_items(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  refund_amount numeric not null check (refund_amount >= 0),
  reason text not null,
  -- Faulty stock returns to the shelf as faulty, not as sellable.
  restock boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sale_returns enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'sale_returns' and policyname = 'Users manage their own returns') then
    create policy "Users manage their own returns" on public.sale_returns
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.process_return(
  p_sale_item_id uuid,
  p_quantity integer,
  p_reason text,
  p_restock boolean default true,
  p_unit_ids uuid[] default null
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.sale_items%rowtype;
  v_product public.products%rowtype;
  v_returned integer;
  v_refund numeric;
  v_return_id uuid;
  v_remaining integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  select * into v_item from public.sale_items
  where id = p_sale_item_id and user_id = v_user_id for update;
  if not found then raise exception 'Sale item not found'; end if;

  -- Guard against refunding the same line twice.
  select coalesce(sum(quantity), 0) into v_returned
  from public.sale_returns where sale_item_id = p_sale_item_id and user_id = v_user_id;

  if v_returned + p_quantity > v_item.quantity then
    raise exception 'Cannot return more than was sold on this line';
  end if;

  select * into v_product from public.products
  where id = v_item.product_id and user_id = v_user_id for update;

  v_refund := v_item.price * p_quantity;

  if found and v_product.is_serialized then
    if p_unit_ids is null or array_length(p_unit_ids, 1) <> p_quantity then
      raise exception 'Select the IMEI unit(s) being returned';
    end if;

    update public.product_units
    set status = case when p_restock then 'in_stock' else 'faulty' end,
        sale_item_id = null,
        sold_at = null
    where id = any(p_unit_ids) and user_id = v_user_id and status = 'sold';

    if not found then raise exception 'Those units are not recorded as sold'; end if;
  elsif found and p_restock then
    update public.products set pieces = pieces + p_quantity
    where id = v_product.id and user_id = v_user_id;
  end if;

  insert into public.sale_returns (
    user_id, sale_id, sale_item_id, product_id, quantity, refund_amount, reason, restock
  )
  values (
    v_user_id, v_item.sale_id, p_sale_item_id, v_item.product_id,
    p_quantity, v_refund, p_reason, p_restock
  )
  returning id into v_return_id;

  -- Mark the parent sale so reports and receipts show the true state.
  select sum(si.quantity) - coalesce((
    select sum(r.quantity) from public.sale_returns r where r.sale_id = v_item.sale_id
  ), 0)
  into v_remaining
  from public.sale_items si where si.sale_id = v_item.sale_id;

  update public.sales
  set status = case when coalesce(v_remaining, 0) <= 0 then 'returned' else 'partially_returned' end
  where id = v_item.sale_id and user_id = v_user_id;

  return v_return_id;
end;
$$;

revoke all on function public.process_return(uuid, integer, text, boolean, uuid[]) from public, anon;
grant execute on function public.process_return(uuid, integer, text, boolean, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime for the new tables
-- ---------------------------------------------------------------------------
do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array['product_units', 'sale_returns', 'suppliers']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table_name);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Opt-in conversion to serialised stock
--
-- Deliberately explicit and deliberately refuses to guess. A shop converts a
-- product only once it has registered a real IMEI for every handset on the
-- shelf; until then the product keeps trading on a plain piece count.
--
--   select public.convert_product_to_serialized('<product-id>');
--
-- Raises rather than silently rewriting the count if the units do not cover the
-- stock, which is what makes it safe to run on a live shop.
-- ---------------------------------------------------------------------------
create or replace function public.convert_product_to_serialized(p_product_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_product public.products%rowtype;
  v_units integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select * into v_product from public.products
  where id = p_product_id and user_id = v_user_id for update;
  if not found then raise exception 'Product not found'; end if;

  if v_product.is_serialized then
    return v_product.pieces;
  end if;

  select count(*) into v_units
  from public.product_units
  where product_id = p_product_id and user_id = v_user_id and status = 'in_stock';

  if v_units <> v_product.pieces then
    raise exception
      'Register an IMEI for every unit first: % in stock but % IMEI(s) recorded for %',
      v_product.pieces, v_units, v_product.name;
  end if;

  update public.products
  set is_serialized = true, pieces = v_units
  where id = p_product_id and user_id = v_user_id;

  return v_units;
end;
$$;

revoke all on function public.convert_product_to_serialized(uuid) from public, anon;
grant execute on function public.convert_product_to_serialized(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Signup hardening
--
-- `user_profiles.username` is UNIQUE and the signup trigger writes it, so a
-- taken username aborted the whole signup with a raw Postgres error:
--
--   HTTP 500  duplicate key value violates unique constraint
--             "user_profiles_username_key"
--
-- RLS also means an anonymous visitor selecting from user_profiles always gets
-- an empty result, so the app could not check availability before submitting.
-- This SECURITY DEFINER function answers that one question and nothing else.
-- ---------------------------------------------------------------------------
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.user_profiles
    where lower(username) = lower(trim(p_username))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Give the trigger a clean, recognisable failure for the race that survives the
-- pre-check, instead of leaking a constraint name to the shop floor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(trim(new.raw_user_meta_data->>'username'), '');
begin
  if v_username is not null and exists (
    select 1 from public.user_profiles where lower(username) = lower(v_username)
  ) then
    raise exception 'username_taken' using errcode = 'unique_violation';
  end if;

  insert into public.user_profiles (id, username, full_name, email, phone, shop_name)
  values (
    new.id,
    v_username,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'shop_name'
  );
  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';
