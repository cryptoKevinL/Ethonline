-- Fix secondary_token_preference column type from integer to text
-- This allows storing token names like 'usdc', 'usdt', 'dai' instead of just numbers

-- Change the column type from integer to text
ALTER TABLE public.employments 
ALTER COLUMN secondary_token_preference TYPE text;

-- Update the comment to reflect the correct data type
COMMENT ON COLUMN public.employments.secondary_token_preference IS 'Secondary payment token preference (e.g., usdc, usdt, dai) - stored as text';
