-- Add group_name field to employments table to support multiple groups per company
-- This allows companies to have multiple payment groups with different names

-- Add group_name column to employments table
ALTER TABLE public.employments 
ADD COLUMN group_name text NULL;

-- Add comment to clarify the purpose
COMMENT ON COLUMN public.employments.group_name IS 'Name of the payment group this employment belongs to (allows multiple groups per company)';

-- Create an index for efficient querying by group name
CREATE INDEX IF NOT EXISTS idx_employments_group_name 
ON public.employments (group_name);

-- Create a composite index for efficient querying by employer and group
CREATE INDEX IF NOT EXISTS idx_employments_employer_group 
ON public.employments (employer_id, group_name);
