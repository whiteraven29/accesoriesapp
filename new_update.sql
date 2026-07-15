-- DukaSmart consolidated update for an EXISTING Supabase project.
-- Run this entire file once in the Supabase SQL Editor after the original
-- schema/older migrations have already been installed.

begin;

-- Receipt data required by checkout and receipt editing.
alter table public.sales
  add column if not exists customer_name text,
  add column if not exists signature text,
  add column if not exists description text;

comment on column public.sales.customer_name is 'Customer name for receipt';
comment on column public.sales.signature is 'Signature text for receipt';
comment on column public.sales.description is 'Additional notes or description for receipt';

-- Operating expenses used to calculate net profit.
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  amount numeric not null check (amount > 0),
  description text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
drop policy if exists "Users can view their own expenses" on public.expenses;
drop policy if exists "Users can insert their own expenses" on public.expenses;
drop policy if exists "Users can update their own expenses" on public.expenses;
drop policy if exists "Users can delete their own expenses" on public.expenses;
create policy "Users can view their own expenses" on public.expenses for select using (auth.uid() = user_id);
create policy "Users can insert their own expenses" on public.expenses for insert with check (auth.uid() = user_id);
create policy "Users can update their own expenses" on public.expenses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own expenses" on public.expenses for delete using (auth.uid() = user_id);

-- A compact inventory audit. Every change to product quantity is recorded,
-- whether it comes from checkout, restocking, a loss, or a manual correction.
create table if not exists public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  quantity_change integer not null check (quantity_change <> 0),
  stock_before integer not null,
  stock_after integer not null check (stock_after >= 0),
  reason text not null default 'adjustment',
  created_at timestamptz not null default now()
);

alter table public.stock_movements enable row level security;
drop policy if exists "Users can view their own stock movements" on public.stock_movements;
create policy "Users can view their own stock movements" on public.stock_movements for select using (auth.uid() = user_id);

create or replace function public.record_stock_movement()
returns trigger
language plpgsql
security invoker
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

drop trigger if exists products_record_stock_movement on public.products;
create trigger products_record_stock_movement
after update of pieces on public.products
for each row execute function public.record_stock_movement();

-- Remove the conflicting old five-argument function and the six-argument
-- wrapper. The wrapper must be dropped first because it may depend on the old
-- function. Recreating one implementation fixes PostgreSQL error 42725.
drop function if exists public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text);
drop function if exists public.complete_sale(numeric, numeric, jsonb, uuid, numeric);

create function public.complete_sale(
  p_total numeric,
  p_cash_received numeric,
  p_items jsonb,
  p_customer_id uuid,
  p_loan_amount numeric,
  p_customer_name text
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
  v_calculated_total numeric := 0;
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
    raise exception 'A customer is required for a loan sale';
  end if;

  insert into public.sales (user_id, total, cash_received, change, customer_name)
  values (
    v_user_id,
    p_total,
    p_cash_received,
    greatest(0, p_cash_received - (p_total - p_loan_amount)),
    nullif(trim(p_customer_name), '')
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = (v_item->>'productId')::uuid
      and user_id = v_user_id
    for update;

    if not found then raise exception 'Product not found'; end if;
    if (v_item->>'quantity')::integer <= 0 then
      raise exception 'Invalid quantity';
    end if;
    if (v_item->>'price')::numeric < 0 then
      raise exception 'Invalid price';
    end if;
    if v_product.pieces < (v_item->>'quantity')::integer then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;

    insert into public.sale_items (
      user_id, sale_id, product_id, quantity, price, buying_price
    ) values (
      v_user_id,
      v_sale_id,
      v_product.id,
      (v_item->>'quantity')::integer,
      (v_item->>'price')::numeric,
      v_product.buying_price
    );

    v_calculated_total := v_calculated_total
      + ((v_item->>'quantity')::integer * (v_item->>'price')::numeric);

    update public.products
    set pieces = pieces - (v_item->>'quantity')::integer
    where id = v_product.id and user_id = v_user_id;
  end loop;

  if round(v_calculated_total, 2) <> round(p_total, 2) then
    raise exception 'Sale total does not match its items';
  end if;

  if p_loan_amount > 0 then
    update public.customers
    set loan_balance = loan_balance + p_loan_amount
    where id = p_customer_id and user_id = v_user_id;

    if not found then raise exception 'Customer not found'; end if;

    insert into public.customer_loan_history (
      user_id, customer_id, type, amount, description
    ) values (
      v_user_id,
      p_customer_id,
      'loan',
      p_loan_amount,
      'Loan for sale ' || v_sale_id
    );
  end if;

  return v_sale_id;
end;
$$;

revoke all on function public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text)
from public, anon;
grant execute on function public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text)
to authenticated;

-- Enable the realtime subscriptions used by the application without trying
-- to add a table that is already in the publication.
do $$
declare
  v_table_name text;
begin
  foreach v_table_name in array array[
    'customers',
    'customer_loan_history',
    'products',
    'sales',
    'sale_items',
    'losses',
    'expenses',
    'stock_movements'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table_name
      );
    end if;
  end loop;
end;
$$;

commit;

-- Refresh PostgREST after the transaction commits so it sees one RPC only.
notify pgrst, 'reload schema';
