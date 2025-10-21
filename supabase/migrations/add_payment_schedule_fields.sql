-- Add payment schedule fields to employments table
-- This migration adds fields for automatic payment scheduling

-- Add new columns to employments table
ALTER TABLE public.employments 
ADD COLUMN payment_frequency text NULL,
ADD COLUMN payment_start_date date NULL,
ADD COLUMN payment_end_date date NULL,
ADD COLUMN payment_day_of_week text NULL;

-- Add check constraint for payment_frequency
ALTER TABLE public.employments 
ADD CONSTRAINT chk_payment_frequency_new CHECK (
  payment_frequency IS NULL OR payment_frequency = ANY (
    ARRAY[
      'daily'::text,
      'weekly'::text,
      'biweekly'::text,
      'monthly'::text
    ]
  )
);

-- Add check constraint for payment_day_of_week
ALTER TABLE public.employments 
ADD CONSTRAINT chk_payment_day_of_week CHECK (
  payment_day_of_week IS NULL OR payment_day_of_week = ANY (
    ARRAY[
      'monday'::text,
      'tuesday'::text,
      'wednesday'::text,
      'thursday'::text,
      'friday'::text,
      'saturday'::text,
      'sunday'::text
    ]
  )
);

-- Add check constraint for date logic
ALTER TABLE public.employments 
ADD CONSTRAINT chk_payment_dates CHECK (
  payment_start_date IS NULL OR 
  payment_end_date IS NULL OR 
  payment_start_date <= payment_end_date
);

-- Add comments for documentation
COMMENT ON COLUMN public.employments.payment_frequency IS 'Frequency of automatic payments: daily, weekly, biweekly, or monthly';
COMMENT ON COLUMN public.employments.payment_start_date IS 'Date when automatic payments should start';
COMMENT ON COLUMN public.employments.payment_end_date IS 'Date when automatic payments should end (optional)';
COMMENT ON COLUMN public.employments.payment_day_of_week IS 'Day of the week when payments should be made (for weekly/biweekly/monthly)';
