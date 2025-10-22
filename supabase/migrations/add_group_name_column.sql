-- Add group_name column to employments table
ALTER TABLE public.employments 
ADD COLUMN group_name text NULL;
