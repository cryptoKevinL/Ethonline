-- Enable multiple employments per employee by removing the unique constraint
-- This allows employees to work for multiple companies simultaneously

-- Drop the unique index that prevents multiple employments
DROP INDEX IF EXISTS public.ux_wallets_employee_default;

-- Create a new unique index that allows multiple employments but ensures
-- only one default wallet per employee (across all employments)
CREATE UNIQUE INDEX IF NOT EXISTS ux_wallets_employee_default 
ON public.wallets (employee_id) 
WHERE is_default = true;

-- Add a comment to clarify the new behavior
COMMENT ON INDEX public.ux_wallets_employee_default IS 'Ensures only one default wallet per employee across all employments';
