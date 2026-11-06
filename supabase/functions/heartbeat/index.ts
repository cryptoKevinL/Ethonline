// supabase/functions/heartbeat/index.ts
// Deno Edge Function for paystream.cc — receives file_count from VM monitor
// Deploy: supabase functions deploy heartbeat --no-verify-jwt
// Env: HEARTBEAT_TOKEN (set in Supabase dashboard > Edge Functions > Secrets)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': 'https://paystream.cc',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...CORS, 'Content-Type': 'application/json' }})
  }

  // 1. Auth — VM sends Authorization: Bearer <HEARTBEAT_TOKEN>
  const token = Deno.env.get('HEARTBEAT_TOKEN')
  const auth = req.headers.get('authorization') || ''
  if (!token || auth !== `Bearer ${token}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }})
  }

  // 2. Parse body from VM monitor
  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }})
  }
  const { hostname, watch_path, file_count, timestamp, delta } = body
  if (typeof file_count !== 'number') {
    return new Response(JSON.stringify({ error: 'file_count number required' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }})
  }

  // 3. Store in Postgres (service_role bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { error } = await supabase.from('heartbeats').insert({
    hostname,
    watch_path,
    file_count,
    delta,
    received_at: new Date().toISOString(),
    client_timestamp: timestamp,
  })

  if (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: 'db insert failed', detail: error.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }})
  }

  // 4. Ack only — never return commands to execute
  return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' }})
})
