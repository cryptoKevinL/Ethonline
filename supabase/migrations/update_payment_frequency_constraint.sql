-- Update payment_frequency constraint to allow both hourly and daily
-- First, drop the existing constraint
ALTER TABLE public.employments 
DROP CONSTRAINT IF EXISTS chk_payment_frequency;

-- Add the new constraint with both hourly and daily options
ALTER TABLE public.employments 
ADD CONSTRAINT chk_payment_frequency CHECK (
  payment_frequency IS NULL OR payment_frequency = ANY (
    ARRAY[
      'hourly'::text,
      'daily'::text,
      'weekly'::text,
      'biweekly'::text,
      'monthly'::text,
      'annual'::text
    ]
  )
);
