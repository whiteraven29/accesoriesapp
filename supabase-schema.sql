-- Create user_profiles table for additional user information
create table user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique,
  full_name text,
  phone text,
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
  loyalty_points integer default 0,
  loan_balance numeric default 0,
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
  buying_price numeric not null,
  selling_price numeric not null,
  pieces integer not null,
  low_stock_alert integer default 5,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sales table
create table sales (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  total numeric not null,
  cash_received numeric not null,
  change numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sale_items table
create table sale_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity integer not null,
  price numeric not null
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
  insert into public.user_profiles (id, username, full_name)
  values (new.id, new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Create trigger to automatically create user profile
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();