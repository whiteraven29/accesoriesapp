# Supabase Setup Guide

This guide will help you set up Supabase for your React Native Expo application.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up or log in to your account
2. Click on "New Project"
3. Enter your project details:
   - Project name (e.g., "accessories-app")
   - Database password (make sure to remember this)
   - Select a region closest to you
4. Click "Create New Project"

## 2. Get Your Supabase Credentials

After your project is created, you'll need to get two important values:

1. **Project URL**: 
   - In your Supabase dashboard, click on the "Settings" icon (gear) in the left sidebar
   - Go to "API" tab
   - Copy the "Project URL" - this is your `EXPO_PUBLIC_SUPABASE_URL`

2. **Anonymous Key**:
   - On the same "API" tab, copy the "anon" key - this is your `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## 3. Configure Environment Variables

Update your `.env` file with the values you copied:

```env
EXPO_PUBLIC_SUPABASE_URL=your_project_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

## 4. Create Database Tables

In your Supabase dashboard:

1. Click on "Table Editor" in the left sidebar
2. Click "New Table" and create the following tables:

### Customers Table
```sql
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
```

### Customer Loan History Table
```sql
-- Create customer_loan_history table
create table customer_loan_history (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references customers(id) on delete cascade,
  type text not null check (type in ('loan', 'payment')),
  amount numeric not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Products Table
```sql
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
```

### Sales Table
```sql
-- Create sales table
create table sales (
  id uuid default gen_random_uuid() primary key,
  total numeric not null,
  cash_received numeric not null,
  change numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Sale Items Table
```sql
-- Create sale_items table
create table sale_items (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity integer not null,
  price numeric not null
);
```

## 5. Set up Row Level Security (RLS)

To enable RLS on all tables, run these commands in the SQL editor:

```sql
alter table customers enable row level security;
alter table customer_loan_history enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
```

## 6. Run Your Application

After setting up the database tables, you can run your application:

```bash
npm start
```

Your app should now be connected to Supabase and using the remote database instead of mock data.