-- ============================================================================
-- DukaSmart v7 — winga (middlemen): consignment stock and a third price tier
--
-- Run once in the Supabase SQL editor, after migration_v6_receipt_archive.sql.
--
-- THE TRADE THIS MODELS
--   A shop buys a handset from a supplier at 230,000 and would sell it over the
--   counter at 300,000. Most stock does not go over the counter: it goes to a
--   winga — a middleman — at an agreed 270,000, and he sells it on. Sometimes he
--   pays there and then. Often he takes the phone and brings the money later,
--   and sometimes he brings the phone back unsold.
--
--   Those last two are different events and the books must not confuse them:
--
--   * ON CREDIT — the phone is sold. Revenue and profit are booked now, and the
--     winga carries the debt. This needs nothing new: it is `complete_sale`
--     with the winga as the customer and `p_loan_amount` set to the balance,
--     which the app has always been able to do.
--
--   * ON CONSIGNMENT — the phone is NOT sold. It is still the shop's property,
--     merely out of the shop. No revenue, no profit, no debt. It leaves the
--     piece count because it is off the shelf, and it comes back either as a
--     settlement (then it is a sale) or as a return (then it is stock again).
--     Booking this as revenue would inflate every report with phones that may
--     never sell, which is what this migration exists to prevent.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Who the shop deals with
--
-- A winga is not a different table: the balance, the loan history and the
-- statement machinery are the same. It is a walk-in buyer with a different
-- relationship, so it is a flag on the row the app filters by.
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists type text not null default 'customer';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customers_type_check'
  ) then
    alter table public.customers
      add constraint customers_type_check check (type in ('customer', 'winga'));
  end if;
end $$;

comment on column public.customers.type is
  'customer = walk-in buyer; winga = middleman who takes stock to resell.';

create index if not exists customers_type_idx on public.customers (user_id, type);

-- ---------------------------------------------------------------------------
-- 2. The middleman price
--
-- The third tier between buying_price and selling_price. Null means this
-- product has no agreed winga price and the counter price stands.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists agent_price numeric check (agent_price >= 0);

comment on column public.products.agent_price is
  'Agreed price to a winga, between buying_price and selling_price. Null falls back to selling_price.';

-- ---------------------------------------------------------------------------
-- 3. A handset can be out with a winga
-- ---------------------------------------------------------------------------
alter table public.product_units
  add column if not exists agent_id uuid references public.customers(id) on delete set null,
  add column if not exists handed_over_at timestamptz,
  add column if not exists agreed_price numeric check (agreed_price >= 0);

comment on column public.product_units.agreed_price is
  'What the winga owes for this handset when it settles. Fixed at handover so a later price change cannot rewrite the deal.';

-- `with_agent` is off the shelf but still owned. The stock trigger counts only
-- `in_stock`, so the piece count drops on handover without any extra work.
alter table public.product_units drop constraint if exists product_units_status_check;
alter table public.product_units
  add constraint product_units_status_check
  check (status in ('in_stock', 'sold', 'returned', 'faulty', 'written_off', 'with_agent'));

create index if not exists product_units_agent_idx
  on public.product_units (user_id, agent_id)
  where status = 'with_agent';

-- ---------------------------------------------------------------------------
-- 4. hand_to_agent — stock leaves the shop, nothing is sold
-- ---------------------------------------------------------------------------
create or replace function public.hand_to_agent(
  p_agent_id uuid,
  p_unit_ids uuid[],
  p_price numeric default null
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_moved integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_unit_ids is null or array_length(p_unit_ids, 1) is null then
    raise exception 'Select at least one handset';
  end if;
  if p_price is not null and p_price < 0 then
    raise exception 'Price cannot be negative';
  end if;

  if not exists (
    select 1 from public.customers
    where id = p_agent_id and user_id = v_user_id and type = 'winga'
  ) then
    raise exception 'That contact is not a winga';
  end if;

  -- Lock the units so two tills cannot hand the same handset to two people.
  perform 1 from public.product_units
  where id = any(p_unit_ids) and user_id = v_user_id and status = 'in_stock'
  for update;

  update public.product_units u
  set status = 'with_agent',
      agent_id = p_agent_id,
      handed_over_at = now(),
      -- Falls back to the product's agreed winga price, then the counter price.
      agreed_price = coalesce(
        p_price,
        (select coalesce(p.agent_price, p.selling_price) from public.products p where p.id = u.product_id)
      )
  where u.id = any(p_unit_ids)
    and u.user_id = v_user_id
    and u.status = 'in_stock';

  get diagnostics v_moved = row_count;

  if v_moved <> array_length(p_unit_ids, 1) then
    raise exception 'One or more handsets are no longer in stock';
  end if;

  return v_moved;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. return_from_agent — it did not sell, put it back on the shelf
-- ---------------------------------------------------------------------------
create or replace function public.return_from_agent(
  p_unit_ids uuid[]
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_moved integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  update public.product_units
  set status = 'in_stock',
      agent_id = null,
      handed_over_at = null,
      agreed_price = null
  where id = any(p_unit_ids)
    and user_id = v_user_id
    and status = 'with_agent';

  get diagnostics v_moved = row_count;
  if v_moved = 0 then raise exception 'Those handsets are not out with a winga'; end if;

  return v_moved;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. settle_with_agent — the winga has sold it and is paying
--
-- This is the moment the sale actually happens. It writes a normal sale, so the
-- handsets appear in reports, on receipts and in the IMEI lookup exactly like
-- any other, at the price fixed when they were handed over.
-- ---------------------------------------------------------------------------
create or replace function public.settle_with_agent(
  p_agent_id uuid,
  p_unit_ids uuid[],
  p_cash_received numeric default 0,
  p_loan_amount numeric default 0
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sale_id uuid;
  v_sale_item_id uuid;
  v_total numeric := 0;
  v_agent public.customers%rowtype;
  v_group record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_cash_received < 0 or p_loan_amount < 0 then
    raise exception 'Amounts cannot be negative';
  end if;

  select * into v_agent from public.customers
  where id = p_agent_id and user_id = v_user_id and type = 'winga';
  if not found then raise exception 'That contact is not a winga'; end if;

  -- Lock and total at the price agreed when the handsets left the shop.
  perform 1 from public.product_units
  where id = any(p_unit_ids) and user_id = v_user_id
    and agent_id = p_agent_id and status = 'with_agent'
  for update;

  select coalesce(sum(coalesce(agreed_price, 0)), 0) into v_total
  from public.product_units
  where id = any(p_unit_ids) and user_id = v_user_id
    and agent_id = p_agent_id and status = 'with_agent';

  if v_total = 0 then raise exception 'Those handsets are not out with this winga'; end if;
  if p_cash_received + p_loan_amount < v_total then
    raise exception 'Payment and credit do not cover %', v_total;
  end if;

  insert into public.sales (
    user_id, total, cash_received, change, customer_name, customer_id,
    payment_method, loan_amount
  )
  values (
    v_user_id, v_total, p_cash_received,
    greatest(0, p_cash_received - (v_total - p_loan_amount)),
    v_agent.name, p_agent_id,
    case when p_loan_amount >= v_total then 'credit' else 'cash' end,
    p_loan_amount
  )
  returning id into v_sale_id;

  -- One sale line per product, however many handsets of it are settling.
  for v_group in
    select u.product_id,
           count(*)::integer as quantity,
           sum(coalesce(u.agreed_price, 0)) as line_total,
           array_agg(u.id) as unit_ids,
           array_agg(u.imei order by u.imei) as imeis
    from public.product_units u
    where u.id = any(p_unit_ids) and u.user_id = v_user_id
      and u.agent_id = p_agent_id and u.status = 'with_agent'
    group by u.product_id
  loop
    insert into public.sale_items (
      user_id, sale_id, product_id, quantity, price, buying_price, imeis, warranty_until
    )
    values (
      v_user_id, v_sale_id, v_group.product_id, v_group.quantity,
      v_group.line_total / v_group.quantity,
      (select buying_price from public.products where id = v_group.product_id),
      v_group.imeis,
      (select case when warranty_days > 0 then (current_date + warranty_days)::date end
       from public.products where id = v_group.product_id)
    )
    returning id into v_sale_item_id;

    update public.product_units
    set status = 'sold',
        sale_item_id = v_sale_item_id,
        sold_at = now(),
        agent_id = null,
        handed_over_at = null,
        warranty_until = (
          select case when warranty_days > 0 then (current_date + warranty_days)::date end
          from public.products where id = v_group.product_id
        )
    where id = any(v_group.unit_ids) and user_id = v_user_id;
  end loop;

  if p_loan_amount > 0 then
    update public.customers
    set loan_balance = loan_balance + p_loan_amount
    where id = p_agent_id and user_id = v_user_id;

    insert into public.customer_loan_history (user_id, customer_id, type, amount, description)
    values (v_user_id, p_agent_id, 'loan', p_loan_amount, 'Winga settlement ' || v_sale_id);
  end if;

  return v_sale_id;
end;
$$;

revoke all on function public.hand_to_agent(uuid, uuid[], numeric) from public, anon;
grant execute on function public.hand_to_agent(uuid, uuid[], numeric) to authenticated;
revoke all on function public.return_from_agent(uuid[]) from public, anon;
grant execute on function public.return_from_agent(uuid[]) to authenticated;
revoke all on function public.settle_with_agent(uuid, uuid[], numeric, numeric) from public, anon;
grant execute on function public.settle_with_agent(uuid, uuid[], numeric, numeric) to authenticated;

commit;

notify pgrst, 'reload schema';
