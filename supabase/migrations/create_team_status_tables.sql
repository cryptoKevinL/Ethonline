-- Internal AnvilStack team status area (see docs/team-verification-and-status-site.md).
-- Reads are limited to verified team members: the team-verify edge function
-- stamps team_verified into the user's app_metadata after checking the Google
-- Workspace `hd` claim server-side, and that claim rides in the JWT that
-- auth.jwt() exposes here. Writes are service-role only (edge functions /
-- SQL editor) - no insert/update/delete policies are granted to
-- anon/authenticated roles.
--
-- NOTE: CI does not apply migrations. Run this against the live Supabase
-- project (SQL editor or `supabase db push`) before the feature goes live.

create table if not exists team_status_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists team_build_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,              -- e.g. 'github-actions', 'vercel'
  title text not null,
  status text not null,              -- e.g. 'success', 'failure', 'in_progress'
  url text,
  metadata jsonb not null default '{}'::jsonb,  -- status/metadata only, never secrets
  created_at timestamptz not null default now()
);

alter table team_status_updates enable row level security;
alter table team_build_log enable row level security;

create policy "Verified team members can read status updates"
  on team_status_updates for select
  using ((auth.jwt() -> 'app_metadata' ->> 'team_verified') = 'true');

create policy "Verified team members can read build log"
  on team_build_log for select
  using ((auth.jwt() -> 'app_metadata' ->> 'team_verified') = 'true');

-- Optional seed row so the page isn't empty on first deploy:
-- insert into team_status_updates (title, body, created_by)
-- values ('Status site is live', 'Internal AnvilStack status area is up. Build/log ingestion from GitHub Actions and Vercel comes next.', 'Kevin');
