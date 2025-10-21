-- Enable multiple employments per employee
-- This allows employees to work for multiple companies simultaneously

-- Drop the existing unique index that prevents multiple employments
DROP INDEX IF EXISTS public.ux_wallets_employee_default;

-- The new approach:
-- 1. Each employment can have its own wallet entry
-- 2. Only one wallet per employee can be marked as default
-- 3. Multiple employments are allowed per employee

-- Create a new unique index that ensures only one default wallet per employee
-- but allows multiple non-default wallets for different employments
CREATE UNIQUE INDEX IF NOT EXISTS ux_wallets_employee_default 
ON public.wallets (employee_id) 
WHERE is_default = true;

-- Add a comment to clarify the new behavior
COMMENT ON INDEX public.ux_wallets_employee_default IS 'Ensures only one default wallet per employee across all employments';
