create table public.heartbeats (
  id uuid primary key default gen_random_uuid(),
  hostname text,
  watch_path text,
  file_count int not null,
  delta jsonb,
  client_timestamp timestamptz,
  received_at timestamptz default now()
);

-- RLS: only service_role can write (Edge Function), no public read/write
alter table public.heartbeats enable row level security;
-- optional: allow admins to read via service_role only — no anon policy
