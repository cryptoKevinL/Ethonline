-- Fix wallet cascade constraint to preserve wallets when employments are deleted
-- This allows wallets to persist even when employment relationships are removed

-- Drop the existing foreign key constraint that cascades deletion
ALTER TABLE public.wallets 
DROP CONSTRAINT IF EXISTS wallets_employment_id_fkey;

-- Add a new foreign key constraint that sets employment_id to NULL instead of cascading
ALTER TABLE public.wallets 
ADD CONSTRAINT wallets_employment_id_fkey 
FOREIGN KEY (employment_id) REFERENCES employments (id) ON DELETE SET NULL;

-- Add a comment to clarify the new behavior
COMMENT ON COLUMN public.wallets.employment_id IS 'Employment relationship - set to NULL when employment is deleted, preserving wallet data';
