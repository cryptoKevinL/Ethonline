import { serve } from "https://deno.land/std/http/server.ts";

const BLOCKSCOUT_API_KEY = Deno.env.get("BLOCKSCOUT_API_KEY") ?? "";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "https://paystream.cc",
]);

const CHAIN_TO_HOST: Record<string, string> = {
  // Base
  "base": "base.blockscout.com",
  "8453": "base.blockscout.com",
  "base-sepolia": "base-sepolia.blockscout.com",
  "84532": "base-sepolia.blockscout.com",

  // Ethereum Sepolia
  "ethereum-sepolia": "eth-sepolia.blockscout.com",
  "eth-sepolia": "eth-sepolia.blockscout.com",
  "11155111": "eth-sepolia.blockscout.com",

  // Optimism Sepolia
  "optimism-sepolia": "optimism-sepolia.blockscout.com",
  "11155420": "optimism-sepolia.blockscout.com",

  // Arbitrum Sepolia (example)
  "arbitrum-sepolia": "arbitrum-sepolia.blockscout.com",
  "421614": "arbitrum-sepolia.blockscout.com",

  // Polygon Amoy (example)
  "polygon-amoy": "polygon-amoy.blockscout.com",
  "80002": "polygon-amoy.blockscout.com",
};
const ALLOWED_HOSTS = new Set<string>(Object.values(CHAIN_TO_HOST));

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://paystream.cc";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "Cache-Control": "public, max-age=30",
  };
}

function sanitizeHost(h: string | null): string | null {
  if (!h) return null;
  const host = h.trim().toLowerCase();
  return ALLOWED_HOSTS.has(host) ? host : null;
}

serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  // Log request for debugging
  console.log("Request method:", req.method);
  console.log("Request URL:", req.url);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  try {
    const url = new URL(req.url);
    const api = (url.searchParams.get("api") || "v2").toLowerCase(); // 'v2' | 'v1'
    const chain = url.searchParams.get("chain");
    const hostParam = url.searchParams.get("host");

    let host: string | null = sanitizeHost(hostParam);
    if (!host && chain) host = CHAIN_TO_HOST[chain] ?? null;
    if (!host) {
      console.log("No host found for chain:", chain);
      return new Response(JSON.stringify({
        error: "Unknown or disallowed host/chain. Provide ?chain=<name|chainId> or ?host=<allowed-host>.",
        allowedChains: Object.keys(CHAIN_TO_HOST),
        providedChain: chain,
      }), { status: 400, headers: { ...headers, "Content-Type": "application/json" }});
    }

    console.log("Using host:", host);

    // MODE 1: TX by hash
    const hash = url.searchParams.get("hash");
    if (hash) {
      let target: string;
      if (api === "v1") {
        const qs = new URLSearchParams({ module: "transaction", action: "gettxinfo", txhash: hash });
        target = `https://${host}/api?${qs.toString()}`;
      } else {
        target = `https://${host}/api/v2/transactions/${hash}`;
      }
      const r = await fetch(target, { headers: { accept: "application/json", ...(BLOCKSCOUT_API_KEY ? { "X-API-KEY": BLOCKSCOUT_API_KEY } : {}) }});
      const body = await r.text();
      return new Response(body, { status: r.status, headers: { ...headers, "Content-Type": "application/json" }});
    }

    // MODE 2: Address txs (v2 uses cursor-based pagination; no limit/page_size)
    const address = url.searchParams.get("address");
    if (address) {
      console.log("Fetching transactions for address:", address);
      if (api === "v1") {
        // etherscan-compatible (allows offset):
        const page = url.searchParams.get("page") ?? "1";
        const offset = url.searchParams.get("offset") ?? "50";
        const qs = new URLSearchParams({
          module: "account", action: "txlist",
          address, page, offset, sort: "desc"
        });
        const target = `https://${host}/api?${qs.toString()}`;
        const r = await fetch(target, { headers: { accept: "application/json", ...(BLOCKSCOUT_API_KEY ? { "X-API-KEY": BLOCKSCOUT_API_KEY } : {}) }});
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...headers, "Content-Type": "application/json" }});
      } else {
        // v2 REST: supports cursor params: block_number, index, items_count
        const block_number = url.searchParams.get("block_number");
        const index = url.searchParams.get("index");
        const items_count = url.searchParams.get("items_count");

        const qs = new URLSearchParams();
        if (block_number) qs.set("block_number", block_number);
        if (index) qs.set("index", index);
        if (items_count) qs.set("items_count", items_count);
        // NOTE: No page_size/limit in v2; first page defaults to ~50 items.

        const query = qs.toString();
        const target = `https://${host}/api/v2/addresses/${address}/transactions${query ? `?${query}` : ""}`;

        const r = await fetch(target, { headers: { accept: "application/json", ...(BLOCKSCOUT_API_KEY ? { "X-API-KEY": BLOCKSCOUT_API_KEY } : {}) }});
        const body = await r.text();
        return new Response(body, { status: r.status, headers: { ...headers, "Content-Type": "application/json" }});
      }
    }

    return new Response(JSON.stringify({ error: "Provide ?hash=<txHash> or ?address=<wallet>" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
