-- Update wallets table to store secondary payment preferences
-- Rename columns and fix data types to match employments table

-- Rename token_contract to secondary_chain_preference
ALTER TABLE public.wallets 
RENAME COLUMN token_contract TO secondary_chain_preference;

-- Rename token_decimals to secondary_token_preference
ALTER TABLE public.wallets 
RENAME COLUMN token_decimals TO secondary_token_preference;

-- Change secondary_token_preference from integer to text to store token names
ALTER TABLE public.wallets 
ALTER COLUMN secondary_token_preference TYPE text;

-- Add comments to clarify the new purpose of these fields
COMMENT ON COLUMN public.wallets.secondary_chain_preference IS 'Secondary payment chain preference (e.g., ethereum, polygon, arbitrum)';
COMMENT ON COLUMN public.wallets.secondary_token_preference IS 'Secondary payment token preference (e.g., usdc, usdt, dai) - stored as text';
