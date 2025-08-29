# Supabase Setup Guide

This guide will help you set up Supabase for your React Native Expo application with user authentication.

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

## 4. Enable Authentication

In your Supabase dashboard:

1. Click on "Authentication" in the left sidebar
2. Go to "Settings" tab
3. Configure your authentication settings:
   - **Site URL**: Add your app's URL (e.g., `exp://localhost:8081` for development)
   - **Redirect URLs**: Add your app's URL for OAuth redirects
4. Go to "Providers" and enable the authentication providers you want (Email is enabled by default)

## 5. Create Database Tables

In your Supabase dashboard:

1. Click on "SQL Editor" in the left sidebar
2. Copy and paste the entire contents of `supabase-schema.sql` file
3. Click "Run" to execute the schema

**Note**: The schema file includes:
- All table definitions with proper user relationships
- Row Level Security policies for data protection
- Automatic user profile creation trigger
- Complete authentication setup

This will create all necessary tables with proper relationships and Row Level Security policies.

### Tables Created:

- **user_profiles**: Stores additional user information (username, full name, phone)
- **customers**: Customer information with user ownership
- **customer_loan_history**: Loan transaction history
- **products**: Product inventory with user ownership
- **sales**: Sales transactions with user ownership
- **sale_items**: Individual sale items
- **losses**: Product loss tracking

All tables include:
- `user_id` references to ensure data isolation between users
- Row Level Security (RLS) policies for data protection
- Automatic user profile creation on signup

## 6. Verify Setup

After running the schema:

1. Check that all tables were created successfully in the "Table Editor"
2. Verify that RLS is enabled on all tables
3. Test user registration and login in your app

## 7. Data Security Features

The schema includes:

- **Row Level Security (RLS)**: Users can only access their own data
- **User Isolation**: All business data is tied to the authenticated user
- **Automatic Profile Creation**: User profiles are created automatically on signup
- **Cascading Deletes**: Deleting a user automatically cleans up all their data

## 8. Run Your Application

After setting up the database and authentication, you can run your application:

```bash
npm start
```

Your app now includes:

- **User Authentication**: Sign up and login functionality
- **Personalized Experience**: Each user sees only their own data
- **Secure Data Storage**: All business data is protected with Row Level Security
- **Real-time Sync**: Changes are synchronized across devices

## 9. Testing Authentication

1. **Sign Up**: Create a new account with username, email, and password
2. **Email Verification**: Check your email and verify your account
3. **Login**: Sign in with your credentials
4. **Data Isolation**: Add some products/customers and verify they're user-specific

The authentication system is now fully integrated with your accessories app!