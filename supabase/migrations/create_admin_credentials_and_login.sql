-- Admin login for public/admin-purchases.html.
-- The password hash is never exposed to the client: admin_credentials has RLS
-- enabled with no policies at all (unreachable via the anon key), and the
-- only way to check a login is the security-definer function below, which
-- returns a boolean and never the hash itself.

create extension if not exists pgcrypto with schema extensions;

create table if not exists admin_credentials (
  username text primary key,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table admin_credentials enable row level security;
-- Intentionally no policies: locked to anon/authenticated, only readable
-- from inside the security-definer function below (or the service role).

insert into admin_credentials (username, password_hash)
values ('Adm1n', extensions.crypt('Pay$tream!@34!@34', extensions.gen_salt('bf')))
on conflict (username) do nothing;

create or replace function verify_admin_login(p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash
  from admin_credentials
  where username = p_username;

  if stored_hash is null then
    return false;
  end if;

  return stored_hash = crypt(p_password, stored_hash);
end;
$$;

revoke all on function verify_admin_login(text, text) from public;
grant execute on function verify_admin_login(text, text) to anon, authenticated;
