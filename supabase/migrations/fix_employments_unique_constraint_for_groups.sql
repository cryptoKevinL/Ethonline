-- Fix employments unique constraint to allow multiple groups per company
-- This allows the same employee to be in multiple groups for the same company

-- Drop the existing unique constraint that prevents multiple employments per employer-employee pair
ALTER TABLE public.employments 
DROP CONSTRAINT IF EXISTS employments_employer_id_employee_id_key;

-- Create a new unique constraint that includes group_name
-- This allows the same employee to be in different groups for the same company
-- but prevents duplicate employments within the same group
ALTER TABLE public.employments 
ADD CONSTRAINT employments_employer_employee_group_key 
UNIQUE (employer_id, employee_id, group_name);

-- Add a comment to clarify the new behavior
COMMENT ON CONSTRAINT employments_employer_employee_group_key ON public.employments 
IS 'Allows same employee in multiple groups per company, but prevents duplicates within same group';
