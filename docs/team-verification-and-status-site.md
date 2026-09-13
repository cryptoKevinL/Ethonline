# AnvilStack team verification + internal status site

Spec requested by Kevin on 2026-09-13. Filed as a doc because GitHub Issues are disabled on this repo.

## Context

We're sharing progress with the AnvilStack team this week, and two things would help the project land well: a way for team members to visibly prove they belong to the org when they use the site, and a private place where the team can follow status without exposing internals publicly. This spec covers both.

## Scope

### Workstream 1 - Verified team sign-in (Google Workspace)

- Add Google sign-in to the app using Supabase Auth's Google provider.
- Restrict sign-in to the AnvilStack Google Workspace domain: after Google returns the ID token, verify the `hd` (hosted domain) claim equals `anvilstack.com`. Anything else is rejected.
- When a signed-in user is confirmed as anvilstack.com, surface verified team status in the frontend (badge / team section) so org membership is provable on the site itself.

### Workstream 2 - Internal AnvilStack status site

- An additional internal site/dashboard for the AnvilStack team, separate from the public experience.
- Private status updates plus details on the build and logs.
- Access limited to verified team members from Workstream 1.

## Suggested approach

- **Auth:** Supabase Auth already backs the app. Enable the Google provider in the Supabase dashboard, trigger `signInWithOAuth` from the frontend, and validate the `hd` claim server-side in an edge function (alongside the existing `admin-purchases` function). Don't trust a client-side-only check - verified status must be gated on server validation.
- **Frontend:** Vite/React app under `src/`. Add a team sign-in entry point and the verified badge/team section. The internal dashboard can be a guarded route group in the same app, or a separate Vercel deployment if we want it fully isolated from the public site.
- **Data:** New Supabase tables for status entries and build/log details, with RLS limiting reads to verified team members and writes to admins. Note: CI does not apply migrations - they must be run against the live Supabase project separately, or the code will merge green while prod stays unchanged.
- **Build/log details:** Start with CI run status from GitHub Actions and deploy status from Vercel. Expose status and metadata only - no env vars, tokens, or credentials anywhere in these views.

## Acceptance criteria

- A team member can sign in with their anvilstack.com Google account and sees verified team status on the site.
- A Google account outside the anvilstack.com domain cannot obtain verified status (rejected server-side, not just hidden in the UI).
- The internal status area is inaccessible to non-verified visitors, enforced by RLS.
- Verified team members can read private status updates and build/log details.
- No secrets or credentials are exposed through any status or log view.
