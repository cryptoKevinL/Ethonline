Deno.serve(() => {
  const now = new Date().toISOString();
  console.log("✅ cron heartbeat:", now);
  return new Response(JSON.stringify({ ok: true, at: now }), {
    headers: { "content-type": "application/json" },
  });
});
