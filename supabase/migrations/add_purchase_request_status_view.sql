-- buy-crypto.html needs to poll the status of the request it just submitted,
-- and INSERT ... RETURNING also needs SELECT visibility of the new row under
-- RLS even though the insert itself is allowed - see Postgres docs on RLS +
-- RETURNING. Re-opening "select * from purchase_requests" to anon would
-- undo the lock_down_purchase_requests_rls.sql fix (full read of every
-- encrypted request). Instead, expose only id+status through a view: the
-- view runs as its owner (bypasses the base table's RLS), and only it is
-- granted to anon, so the base table stays locked down.

create or replace view purchase_request_status as
select id, status from purchase_requests;

grant select on purchase_request_status to anon;
