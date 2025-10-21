-- Rename token_contract and token_decimals to store secondary payment preferences
-- This allows users to have a primary and secondary choice for payment tokens/chains

-- Add comments to clarify the new purpose of these fields
COMMENT ON COLUMN public.employments.token_contract IS 'Secondary payment chain preference (e.g., ethereum, polygon, arbitrum)';
COMMENT ON COLUMN public.employments.token_decimals IS 'Secondary payment token preference (e.g., usdc, usdt, dai)';

-- Note: We're not changing the column names to avoid breaking existing data
-- Instead, we're repurposing the existing columns for secondary preferences
-- token_contract now stores secondary_chain_preference
-- token_decimals now stores secondary_token_preference
