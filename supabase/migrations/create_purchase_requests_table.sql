-- Stores encrypted crypto-purchase form submissions from public/buy-crypto.html.
-- Payload (card + billing address) is only ever stored as RSA/AES-encrypted
-- ciphertext; it is decrypted in the admin's browser using the private key
-- they hold locally (see public/admin-purchases.html), never on the server.
create table if not exists purchase_requests (
  id uuid primary key default gen_random_uuid(),
  encrypted_key text not null,
  iv text not null,
  ciphertext text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table purchase_requests enable row level security;

-- The public buy page (anon key) needs to be able to create requests.
create policy "Anyone can submit a purchase request"
  on purchase_requests for insert
  with check (true);

-- Prototype only: open read/update so the admin page (no auth yet) can list
-- and decide requests. Replace with an authenticated-admin-only policy
-- before this goes anywhere near production.
create policy "Anyone can view purchase requests"
  on purchase_requests for select
  using (true);

create policy "Anyone can update purchase request status"
  on purchase_requests for update
  using (true)
  with check (true);
