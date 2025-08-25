# Accessories App

A React Native Expo application for managing an accessories business with customers, products, sales, and reports functionality.

## Features

- Customer management with loan tracking and loyalty points
- Product inventory management with stock alerts
- Sales tracking with real-time inventory updates
- Reporting dashboard

## Supabase Integration

This application is integrated with Supabase for backend services including:

- Database storage for customers, products, and sales
- Real-time updates using Supabase's real-time subscriptions
- Authentication (to be implemented)

### Setting up Supabase

Follow the instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to set up your Supabase project and configure the application.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Supabase project following the instructions in [SUPABASE_SETUP.md](SUPABASE_SETUP.md)

3. Configure your environment variables in the `.env` file

4. Start the development server:
   ```bash
   npm start
   ```

## Project Structure

- `app/` - Expo Router pages
- `hooks/` - Custom hooks for data management
- `utils/` - Utility functions and Supabase client configuration
- `assets/` - Images and other static assets

## Dependencies

- React Native Expo
- Supabase
- TypeScript
- Tailwind CSS (via NativeWind)

## Learn More

To learn more about the technologies used in this project:

- [Expo Documentation](https://docs.expo.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Native Documentation](https://reactnative.dev/)