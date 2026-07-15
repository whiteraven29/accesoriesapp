-- Create user_profiles table for additional user information
create table user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  email text not null,
  phone text,
  shop_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create customers table
create table customers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  address text,
  loyalty_points integer not null default 0 check (loyalty_points >= 0),
  loan_balance numeric not null default 0 check (loan_balance >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create customer_loan_history table
create table customer_loan_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  customer_id uuid references customers(id) on delete cascade,
  type text not null check (type in ('loan', 'payment')),
  amount numeric not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create products table
create table products (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  brand text,
  category text,
  buying_price numeric not null check (buying_price >= 0),
  selling_price numeric not null check (selling_price >= 0),
  pieces integer not null check (pieces >= 0),
  low_stock_alert integer not null default 5 check (low_stock_alert >= 0),
  imei text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sales table
create table sales (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  total numeric not null,
  cash_received numeric not null,
  change numeric not null,
  customer_name text,
  signature text,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sale_items table
create table sale_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price numeric not null check (price >= 0),
  buying_price numeric not null check (buying_price >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create losses table
create table losses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  quantity integer not null,
  reason text not null,
  description text,
  loss_value numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table user_profiles enable row level security;
alter table customers enable row level security;
alter table customer_loan_history enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table losses enable row level security;

-- Enable Postgres-change broadcasts used by the application hooks.
alter publication supabase_realtime add table customers;
alter publication supabase_realtime add table customer_loan_history;
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table sales;
alter publication supabase_realtime add table sale_items;
alter publication supabase_realtime add table losses;

-- Create RLS policies for user_profiles
create policy "Users can view their own profile" on user_profiles
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on user_profiles
  for update using (auth.uid() = id);

create policy "Users can insert their own profile" on user_profiles
  for insert with check (auth.uid() = id);

-- Create RLS policies for customers
create policy "Users can view their own customers" on customers
  for select using (auth.uid() = user_id);

create policy "Users can insert their own customers" on customers
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own customers" on customers
  for update using (auth.uid() = user_id);

create policy "Users can delete their own customers" on customers
  for delete using (auth.uid() = user_id);

-- Create RLS policies for customer_loan_history
create policy "Users can view their own customer loan history" on customer_loan_history
  for select using (auth.uid() = user_id);

create policy "Users can insert their own customer loan history" on customer_loan_history
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own customer loan history" on customer_loan_history
  for update using (auth.uid() = user_id);

create policy "Users can delete their own customer loan history" on customer_loan_history
  for delete using (auth.uid() = user_id);

-- Create RLS policies for products
create policy "Users can view their own products" on products
  for select using (auth.uid() = user_id);

create policy "Users can insert their own products" on products
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own products" on products
  for update using (auth.uid() = user_id);

create policy "Users can delete their own products" on products
  for delete using (auth.uid() = user_id);

-- Create RLS policies for sales
create policy "Users can view their own sales" on sales
  for select using (auth.uid() = user_id);

create policy "Users can insert their own sales" on sales
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own sales" on sales
  for update using (auth.uid() = user_id);

create policy "Users can delete their own sales" on sales
  for delete using (auth.uid() = user_id);

-- Create RLS policies for sale_items
create policy "Users can view their own sale items" on sale_items
  for select using (auth.uid() = user_id);

create policy "Users can insert their own sale items" on sale_items
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own sale items" on sale_items
  for update using (auth.uid() = user_id);

create policy "Users can delete their own sale items" on sale_items
  for delete using (auth.uid() = user_id);

-- Create RLS policies for losses
create policy "Users can view their own losses" on losses
  for select using (auth.uid() = user_id);

create policy "Users can insert their own losses" on losses
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own losses" on losses
  for update using (auth.uid() = user_id);

create policy "Users can delete their own losses" on losses
  for delete using (auth.uid() = user_id);

-- Create function to automatically create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, username, full_name, email, phone, shop_name)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'shop_name'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Create trigger to automatically create user profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Complete a sale, optionally add customer debt, and reduce inventory atomically.
create or replace function public.complete_sale(
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

    update products set pieces = pieces - (v_item->>'quantity')::integer
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

grant execute on function public.complete_sale(numeric, numeric, jsonb, uuid, numeric, text) to authenticated;

-- Adjust a customer loan and write its audit record in one transaction.
create or replace function public.adjust_customer_loan(
  p_customer_id uuid,
  p_type text,
  p_amount numeric,
  p_description text default null
) returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance numeric;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_type not in ('loan', 'payment') or p_amount <= 0 then
    raise exception 'Invalid loan transaction';
  end if;

  select loan_balance into v_balance from customers
  where id = p_customer_id and user_id = v_user_id for update;
  if not found then raise exception 'Customer not found'; end if;
  if p_type = 'payment' and p_amount > v_balance then
    raise exception 'Payment exceeds the loan balance';
  end if;

  v_balance := case when p_type = 'loan' then v_balance + p_amount else v_balance - p_amount end;
  update customers set loan_balance = v_balance where id = p_customer_id;
  insert into customer_loan_history (user_id, customer_id, type, amount, description)
  values (v_user_id, p_customer_id, p_type, p_amount, p_description);
  return v_balance;
end;
$$;

grant execute on function public.adjust_customer_loan(uuid, text, numeric, text) to authenticated;
