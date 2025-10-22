-- Fix employments unique constraint to allow multiple groups per company
-- Drop the old constraint that only allows one employment per employee per employer
-- Add a new constraint that allows multiple groups per employee per employer

-- Drop the old unique constraint
ALTER TABLE public.employments 
DROP CONSTRAINT IF EXISTS employments_employer_id_employee_id_key;

-- Add a new unique constraint that includes group_name
-- This allows the same employee to be in different groups for the same employer
ALTER TABLE public.employments 
ADD CONSTRAINT employments_employer_employee_group_key 
UNIQUE (employer_id, employee_id, group_name);