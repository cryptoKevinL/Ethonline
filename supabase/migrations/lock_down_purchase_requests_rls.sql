-- The original "prototype only" policies let anyone with the public anon key
-- read every purchase request and approve/reject them directly via the
-- Supabase REST API, completely bypassing admin-purchases.html and the
-- admin password check. Reads/updates now only happen through the
-- admin-purchases edge function, which runs with the service role key
-- (bypasses RLS) after verifying admin credentials.

drop policy if exists "Anyone can view purchase requests" on purchase_requests;
drop policy if exists "Anyone can update purchase request status" on purchase_requests;

-- Insert stays open: the public buy page (anon key) still needs to submit requests.
