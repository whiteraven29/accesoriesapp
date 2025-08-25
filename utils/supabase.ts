import { createClient } from '@supabase/supabase-js';

// These values will need to be replaced with your actual Supabase project URL and anon key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://iivyetvbmpzhnrpvdfdk.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpdnlldHZibXB6aG5ycHZkZmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxMjY0MTgsImV4cCI6MjA3MTcwMjQxOH0.-RswNDifXWaZtM9KH508E6xas2KmjjF7RfETSfekXas';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);