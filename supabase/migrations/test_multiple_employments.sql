-- Test script to verify multiple employments work
-- This is just for testing - you can run this to verify the schema supports multiple employments

-- Example: Employee can work for multiple companies
-- Employee ID: employee-123
-- Employer 1: employer-456 (Company A)
-- Employer 2: employer-789 (Company B)

-- This should work:
-- INSERT INTO employments (employer_id, employee_id, status) VALUES 
--   ('employer-456', 'employee-123', 'active'),
--   ('employer-789', 'employee-123', 'active');

-- Each employment can have its own wallet entry:
-- INSERT INTO wallets (employment_id, employee_id, chain, token, is_default) VALUES
--   ('employment-1', 'employee-123', 'ethereum', 'usdc', true),
--   ('employment-2', 'employee-123', 'polygon', 'usdt', false);

-- The unique constraint on (employer_id, employee_id) prevents duplicate employments
-- but allows the same employee to work for different employers
