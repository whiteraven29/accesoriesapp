-- Create customers table
create table customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text,
  email text,
  address text,
  loyalty_points integer default 0,
  loan_balance numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create customer_loan_history table
create table customer_loan_history (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  type text not null check (type in ('loan', 'payment')),
  amount numeric not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create products table
create table products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  brand text,
  category text,
  buying_price numeric not null,
  selling_price numeric not null,
  pieces integer not null,
  low_stock_alert integer default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sales table
create table sales (
  id uuid default gen_random_uuid() primary key,
  total numeric not null,
  cash_received numeric not null,
  change numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sale_items table
create table sale_items (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity integer not null,
  price numeric not null
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
alter table customers enable row level security;
alter table customer_loan_history enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;