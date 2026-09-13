# Team verification: setup steps

The code is done. What's left lives in web consoles that code can't touch, and
none of it needs a Google Workspace admin - Kevin can do all of it with his own
Google account in about 15 minutes.

How the gate works: anyone can click "Verify with Google", but after Google
signs them in, the `team-verify` edge function checks the hosted-domain (`hd`)
claim on their Google identity server-side and rejects anything that isn't
anvilstack.com. The OAuth consent screen being open to all Google accounts is
fine - the domain check is the gate, and it happens on our server, not in the
browser.

## Part 1 - Google Cloud: create the sign-in credentials (Kevin, ~10 min)

1. Go to **https://console.cloud.google.com** and sign in (your
   kmalone@anvilstack.com account is fine - no admin needed).
2. At the top of the page, click the **project dropdown** (left of the search
   bar), then **New Project**. Name it anything (e.g. `ethonline-auth`), click
   **Create**, then switch into it from the same dropdown.
3. Left menu: **APIs & Services > OAuth consent screen**.
   - User Type: **External**, then **Create**. (External just means any Google
     account can be shown the sign-in screen. Non-anvilstack accounts still get
     rejected by our server-side domain check.)
   - App name: `AnvilStack team verification`
   - User support email and Developer contact email: your own address.
   - **Save and Continue** through the rest (no scopes to add), then back to
     the dashboard.
   - Leave the app in **Testing** publishing status. Add the team's
     @anvilstack.com addresses under **Test users** so only they can sign in
     while testing.
4. Left menu: **APIs & Services > Credentials**.
   - **Create Credentials > OAuth client ID**.
   - Application type: **Web application**. Name: `Supabase Auth`.
   - Under **Authorized redirect URIs**, click **Add URI** and paste:
     `https://<project-ref>.supabase.co/auth/v1/callback`
     (`<project-ref>` is in the Supabase dashboard URL for the Ethonline
     project, or under Project Settings > General - it looks like
     `abcdefghijklmnopqrst`.)
   - **Create**. Copy the **Client ID** and **Client Secret** from the popup.
5. Heads-up for teammates: until the app is published and verified by Google,
     the sign-in flow shows a "Google hasn't verified this app" screen. They
     click **Advanced > Go to AnvilStack team verification (unsafe)** to
     continue. That's expected for an internal tool; publishing for real is
     optional.

## Part 2 - Supabase: turn on Google sign-in (~2 min)

1. Open the Ethonline project at **https://supabase.com/dashboard**.
2. **Authentication > Sign In / Up** (on newer dashboards: **Authentication >
   Providers**), expand **Google**.
3. Toggle **Enable Sign in with Google** on, paste the **Client ID** and
   **Client Secret** from Part 1, **Save**.
4. Check the **Callback URL** shown there matches the redirect URI from Part 1
   exactly. If not, fix it on the Google Cloud Credentials page.

## Part 3 - Migration + function deploy (Kevin, developer steps)

CI does not run migrations or deploy functions, so:

```bash
# Apply the team tables (SQL editor: paste supabase/migrations/create_team_status_tables.sql
# and run it - or with the CLI linked to the project:)
supabase db push

# Deploy the verification function
supabase functions deploy team-verify
```

## Sanity check

1. On the site, click **"AnvilStack team? Verify with Google"** (top-left of the
   landing page, or `/team/verify`).
2. Sign in with an @anvilstack.com account: you land on `/team/status` with the
   green **Verified team** badge.
3. Sign out, try a personal @gmail.com account: you get the "Not an AnvilStack
   account" screen. That rejection is decided server-side in the edge function,
   not in the UI.

## Reference: what lives where

- `src/pages/team/Verify.tsx` - "Verify with Google" entry page.
- `src/pages/team/Status.tsx` - gated internal status page (badge, status
  updates, build/log feed scaffold).
- `src/lib/teamVerification.ts` - flow helpers (OAuth start, server verify,
  session refresh, sign out).
- `supabase/functions/team-verify/index.ts` - validates the session, checks
  the Google `hd` claim, stamps `team_verified` into app_metadata.
- `supabase/migrations/create_team_status_tables.sql` - `team_status_updates`
  and `team_build_log`; RLS lets only verified team members read, and only the
  service role can write (post updates from the SQL editor for now).
- Build/log ingestion from GitHub Actions / Vercel is a follow-up: rows go into
  `team_build_log` (status and metadata only, never env vars or credentials).
