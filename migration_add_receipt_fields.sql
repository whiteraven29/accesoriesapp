-- Migration to add receipt fields to sales table
-- Run this SQL in your Supabase SQL editor or database console

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS signature TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Optional: Add comments for documentation
COMMENT ON COLUMN sales.customer_name IS 'Customer name for receipt';
COMMENT ON COLUMN sales.signature IS 'Signature text for receipt';
COMMENT ON COLUMN sales.description IS 'Additional notes or description for receipt';