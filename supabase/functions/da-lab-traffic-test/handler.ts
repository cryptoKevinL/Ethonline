// da-lab traffic-test receiver — core handler (pure, testable offline).
//
// Accepts authenticated POSTs only, fails closed when no lab token is
// configured, strictly validates a small invented payload, stores the
// server receipt time separately from the client-sent time, and returns
// one fixed, small acknowledgement. It never returns instructions,
// never logs the token or payload secrets (there are none by design),
// and never reads files, runs commands, or calls out anywhere else.

export type LabEvent = {
  run_id: string;
  seq: number;
  counter: number;
  client_sent_at: string;
  received_at: string;
};

export type HandlerDeps = {
  token: string;
  insert: (event: LabEvent) => Promise<void>;
  now?: () => Date;
};

export const MAX_BODY_BYTES = 1024;
export const LAB_NAME = "da-lab-traffic-test";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = ["lab", "run_id", "seq", "counter", "client_sent_at"];

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
const fail = (status: number, error: string) => json(status, { ok: false, error });

async function sha256Hex(text: string): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return new Uint8Array(digest);
}

// Constant-work comparison: hash both sides, then compare every byte.
export async function tokenMatches(provided: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256Hex(provided), sha256Hex(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function validatePayload(value: unknown): { event?: Omit<LabEvent, "received_at">; error?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "payload_not_object" };
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.includes(key)) return { error: "unexpected_field" };
  }
  for (const key of ALLOWED_KEYS) {
    if (!(key in obj)) return { error: "missing_field" };
  }
  if (obj.lab !== LAB_NAME) return { error: "wrong_lab" };
  if (typeof obj.run_id !== "string" || !UUID_RE.test(obj.run_id)) return { error: "bad_run_id" };
  if (!Number.isInteger(obj.seq) || (obj.seq as number) < 1 || (obj.seq as number) > 20) {
    return { error: "bad_seq" };
  }
  if (obj.counter !== obj.seq) return { error: "counter_mismatch" };
  if (typeof obj.client_sent_at !== "string" || obj.client_sent_at.length > 40) {
    return { error: "bad_client_sent_at" };
  }
  const parsed = Date.parse(obj.client_sent_at);
  if (Number.isNaN(parsed)) return { error: "bad_client_sent_at" };
  return {
    event: {
      run_id: obj.run_id,
      seq: obj.seq as number,
      counter: obj.counter as number,
      client_sent_at: new Date(parsed).toISOString(),
    },
  };
}


// Reads a request body as a stream, enforcing maxBytes as bytes
// arrive. Returns a tagged result instead of throwing so read errors
// surface as a clean HTTP response.
export async function readBoundedBody(
  req: Request,
  maxBytes: number,
): Promise<{ text?: string; error?: string }> {
  const body = req.body as ReadableStream<Uint8Array> | null;
  if (!body || typeof body.getReader !== "function") {
    // Fallback for runtimes without a readable request stream.
    try {
      const text = await req.text();
      if (new TextEncoder().encode(text).length > maxBytes) return { error: "too_large" };
      return { text };
    } catch {
      return { error: "read_error" };
    }
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* already closed */ }
        return { error: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    try { await reader.cancel(); } catch { /* already closed */ }
    return { error: "read_error" };
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.byteLength; }
  return { text: new TextDecoder().decode(merged) };
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? (() => new Date());
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return fail(405, "method_not_allowed");
    if (!deps.token) return fail(503, "receiver_not_configured"); // fail closed

    const auth = req.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    if (!provided || !(await tokenMatches(provided, deps.token))) {
      return fail(401, "unauthorized");
    }

    // Exact MIME type only (parameters such as "; charset=utf-8" are
    // fine): substring lookalikes like "text/application/json" or
    // "application/jsonx" are rejected.
    const contentType = req.headers.get("content-type") ?? "";
    const mime = contentType.split(";")[0].trim().toLowerCase();
    if (mime !== "application/json") {
      return fail(415, "unsupported_media_type");
    }
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail(413, "payload_too_large");

    // Bounded streaming read: the cap is enforced chunk by chunk and
    // the stream is cancelled the moment it is crossed — the body is
    // never buffered in full before its size is checked. A stream
    // that errors mid-read is handled cleanly, never thrown through.
    const read = await readBoundedBody(req, MAX_BODY_BYTES);
    if (read.error === "too_large") return fail(413, "payload_too_large");
    if (read.error) return fail(400, "body_read_error");
    const text = read.text ?? "";

    let parsedJson: unknown;
    try { parsedJson = JSON.parse(text); } catch { return fail(400, "invalid_json"); }

    const { event, error } = validatePayload(parsedJson);
    if (error || !event) return fail(400, error ?? "invalid_payload");

    const record: LabEvent = { ...event, received_at: now().toISOString() };
    try {
      await deps.insert(record);
    } catch {
      return fail(500, "store_failed");
    }
    // Fixed, small acknowledgement only — no instructions, ever.
    return json(200, { ok: true, ack: true, seq: record.seq });
  };
}
