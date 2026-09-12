import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Server-side only: reads/updates purchase_requests with the service role
// key after verifying admin credentials, so the anon key never needs
// direct table access. See supabase/migrations/lock_down_purchase_requests_rls.sql.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
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

async function isValidAdmin(username: unknown, password: unknown): Promise<boolean> {
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return false;
  }
  const { data, error } = await admin.rpc("verify_admin_login", {
    p_username: username,
    p_password: password,
  });
  return !error && data === true;
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const { username, password, action } = body;

  if (!(await isValidAdmin(username, password))) {
    return new Response(JSON.stringify({ error: "Invalid username or password" }), { status: 401, headers });
  }

  if (action === "list") {
    const { data, error } = await admin
      .from("purchase_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
    return new Response(JSON.stringify({ rows: data }), { status: 200, headers });
  }

  if (action === "decide") {
    const { id, decision } = body;
    if (typeof id !== "string" || (decision !== "approved" && decision !== "rejected")) {
      return new Response(JSON.stringify({ error: "Invalid decide request" }), { status: 400, headers });
    }

    const { data, error } = await admin
      .from("purchase_requests")
      .update({ status: decision, decided_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
    if (!data) {
      return new Response(JSON.stringify({ error: "Request was not pending (already decided or missing)" }), {
        status: 409,
        headers,
      });
    }
    return new Response(JSON.stringify({ row: data }), { status: 200, headers });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers });
});
