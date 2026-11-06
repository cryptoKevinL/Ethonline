// da-lab traffic-test receiver — Supabase Edge Function entrypoint (Deno).
//
// Deploy as a SEPARATE function named `da-lab-traffic-test`. It does not
// replace or modify the existing `heartbeat` function.
//
// Auth model (read before deploying):
// - supabase/config.toml sets `verify_jwt = false` for THIS function only,
//   so the platform JWT check does not run. That is required because the
//   sender authenticates with a custom lab token, not a Supabase user JWT.
// - Because of that, the custom token check in handler.ts is MANDATORY:
//   the handler fails closed (HTTP 503) when DA_LAB_TEST_TOKEN is not
//   configured, and rejects every request without the exact Bearer token.
// - The database write uses the Supabase service-role key, which Supabase
//   injects into Edge Functions server-side (SUPABASE_URL /
//   SUPABASE_SERVICE_ROLE_KEY). It is never sent to a browser or the sender.

import { createHandler, type LabEvent } from "./handler.ts";

const labToken = Deno.env.get("DA_LAB_TEST_TOKEN") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const INSERT_TIMEOUT_MS = 10_000;

async function insertEvent(event: LabEvent): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("supabase server credentials not configured");
  }
  // Finite insert: a hard timeout, and redirects are refused outright
  // (redirect: "manual") so the server-only service-role key in the
  // headers below is never forwarded to a redirect target.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INSERT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${supabaseUrl}/rest/v1/da_lab_traffic_test_events`, {
      method: "POST",
      redirect: "manual", // never follow: a 3xx fails the insert below
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        prefer: "return=minimal",
      },
      body: JSON.stringify(event),
    });
  } finally {
    clearTimeout(timer);
  }
  // We never read the PostgREST body; cancel it so nothing lingers.
  try { await res.body?.cancel(); } catch { /* already closed */ }
  if (res.status >= 300 && res.status < 400) {
    throw new Error(`postgrest insert redirected: ${res.status}`);
  }
  if (!res.ok) throw new Error(`postgrest insert failed: ${res.status}`);
}

const handler = createHandler({ token: labToken, insert: insertEvent });

Deno.serve(handler);
