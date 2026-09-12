-- The password seeded in create_admin_credentials_and_login.sql
-- ('Adm1n' / 'Pay$tream!@34!@34') was committed in plaintext to this
-- public repo (visible forever in git history regardless of this fix).
-- Delete that credential so it can no longer be used to log in, and give
-- the operator a way to set a real password without ever writing it to a
-- file that gets committed.

delete from admin_credentials where username = 'Adm1n';

create or replace function set_admin_password(p_username text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into admin_credentials (username, password_hash)
  values (p_username, extensions.crypt(p_password, extensions.gen_salt('bf')))
  on conflict (username) do update set password_hash = excluded.password_hash;
end;
$$;

-- service_role only: this must be called from the Supabase SQL editor/CLI
-- (or a server-side script holding the service role key), never from a
-- browser, and the password argument must never be committed to git.
revoke all on function set_admin_password(text, text) from public;
revoke all on function set_admin_password(text, text) from anon, authenticated;
grant execute on function set_admin_password(text, text) to service_role;
