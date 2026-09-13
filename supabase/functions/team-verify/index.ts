import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Verifies that the signed-in Supabase user belongs to the AnvilStack
// Google Workspace domain. The client connects with Google via Supabase
// Auth purely as an attestation of org membership, then calls this
// function with its session token. We re-validate the token server-side
// and check the Google `hd` (hosted domain) claim on the user's Google
// identity. Verified users get team_verified stamped into app_metadata,
// which is what the RLS policies on the internal team tables check.
// Never trust a client-side-only domain check.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TEAM_DOMAIN = (Deno.env.get("TEAM_DOMAIN") ?? "anvilstack.com").toLowerCase();

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "http://localhost:5173",
  "https://paystream.cc",
  "https://pyusd.paystream.cc",
]);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://paystream.cc";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Vary": "Origin",
  };
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return new Response(JSON.stringify({ error: "Missing access token" }), { status: 401, headers });
  }

  // Validate the user's session token against Supabase Auth.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers });
  }

  // Pull the full user record so we can inspect the Google identity's
  // provider data, where the `hd` claim lives for Workspace accounts.
  const { data: fullData, error: fullError } = await admin.auth.admin.getUserById(userData.user.id);
  if (fullError || !fullData?.user) {
    return new Response(JSON.stringify({ error: "Could not load user" }), { status: 500, headers });
  }
  const fullUser = fullData.user;

  const googleIdentity = (fullUser.identities ?? []).find((i) => i.provider === "google");
  const identityData = (googleIdentity?.identity_data ?? {}) as Record<string, unknown>;
  const hd = String(identityData["hd"] ?? fullUser.user_metadata?.["hd"] ?? "").toLowerCase();
  const emailVerified = identityData["email_verified"] === true;

  if (hd !== TEAM_DOMAIN || !emailVerified) {
    return new Response(
      JSON.stringify({
        verified: false,
        reason: "not-anvilstack-domain",
        message: `Verification requires an @${TEAM_DOMAIN} Google Workspace account.`,
      }),
      { status: 403, headers },
    );
  }

  // Stamp verified team status into app_metadata. app_metadata flows into
  // the JWT on the next session refresh, and the RLS policies on the team
  // tables gate reads on it.
  const { error: updateError } = await admin.auth.admin.updateUserById(fullUser.id, {
    app_metadata: {
      ...(fullUser.app_metadata ?? {}),
      team_verified: true,
      team_domain: TEAM_DOMAIN,
    },
  });
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers });
  }

  return new Response(
    JSON.stringify({ verified: true, email: fullUser.email, domain: TEAM_DOMAIN }),
    { status: 200, headers },
  );
});
