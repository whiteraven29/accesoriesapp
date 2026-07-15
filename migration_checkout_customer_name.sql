-- Run this once on projects that had the original five-argument complete_sale.
-- Remove both overloads first: the six-argument wrapper depended on the old
-- function and its default argument made Postgres/PostgREST calls ambiguous.
drop function if exists public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text);
drop function if exists public.complete_sale(numeric, numeric, jsonb, uuid, numeric);

-- Keep one atomic implementation only.
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
  v_product products%rowtype;
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

  insert into sales (user_id, total, cash_received, change, customer_name)
  values (
    v_user_id, p_total, p_cash_received,
    greatest(0, p_cash_received - (p_total - p_loan_amount)),
    nullif(trim(p_customer_name), '')
  )
  returning id into v_sale_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from products
    where id = (v_item->>'productId')::uuid and user_id = v_user_id
    for update;

    if not found then raise exception 'Product not found'; end if;
    if (v_item->>'quantity')::integer <= 0 then raise exception 'Invalid quantity'; end if;
    if v_product.pieces < (v_item->>'quantity')::integer then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;

    insert into sale_items (user_id, sale_id, product_id, quantity, price, buying_price)
    values (
      v_user_id, v_sale_id, v_product.id,
      (v_item->>'quantity')::integer,
      (v_item->>'price')::numeric,
      v_product.buying_price
    );

    v_calculated_total := v_calculated_total
      + ((v_item->>'quantity')::integer * (v_item->>'price')::numeric);

    update products
    set pieces = pieces - (v_item->>'quantity')::integer
    where id = v_product.id;
  end loop;

  if round(v_calculated_total, 2) <> round(p_total, 2) then
    raise exception 'Sale total does not match its items';
  end if;

  if p_loan_amount > 0 then
    update customers set loan_balance = loan_balance + p_loan_amount
    where id = p_customer_id and user_id = v_user_id;
    if not found then raise exception 'Customer not found'; end if;

    insert into customer_loan_history (user_id, customer_id, type, amount, description)
    values (v_user_id, p_customer_id, 'loan', p_loan_amount, 'Loan for sale ' || v_sale_id);
  end if;

  return v_sale_id;
end;
$$;

grant execute on function public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text)
to authenticated;

-- Ask PostgREST to refresh its function metadata immediately.
notify pgrst, 'reload schema';
