-- Rename columns to better reflect their new purpose for secondary payment preferences
-- This makes the database schema clearer and more intuitive

-- Rename token_contract to secondary_chain_preference
ALTER TABLE public.employments 
RENAME COLUMN token_contract TO secondary_chain_preference;

-- Rename token_decimals to secondary_token_preference  
ALTER TABLE public.employments 
RENAME COLUMN token_decimals TO secondary_token_preference;

-- Add comments to clarify the new purpose of these fields
COMMENT ON COLUMN public.employments.secondary_chain_preference IS 'Secondary payment chain preference (e.g., ethereum, polygon, arbitrum)';
COMMENT ON COLUMN public.employments.secondary_token_preference IS 'Secondary payment token preference (e.g., usdc, usdt, dai)';
