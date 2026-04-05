import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import busboy from "busboy";
import { randomUUID } from "node:crypto";

export const config = {
  api: { bodyParser: false },
};

const LOG = "[mydata]";

function log(...args) {
  console.log(LOG, ...args);
}

function logError(...args) {
  console.error(LOG, ...args);
}

function awsErrorDetails(e) {
  if (!e || typeof e !== "object") return { raw: String(e) };
  const o = e;
  const meta = o.$metadata;
  return {
    name: o.name,
    message: o.message,
    code: o.Code ?? o.code,
    httpStatusCode: meta?.httpStatusCode,
    requestId: meta?.requestId,
    bucket: o.BucketName,
    key: o.Key,
  };
}

function header(req, name) {
  const v = req.headers[name.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return v;
}

function applyCors(res, req) {
  for (const [k, v] of Object.entries(corsHeaders(req))) {
    res.setHeader(k, v);
  }
}

function corsHeaders(req) {
  const origin = header(req, "origin");
  return {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Filename, X-Upload-Secret",
    ...(origin
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : { "Access-Control-Allow-Origin": "*" }),
  };
}

function authOk(req) {
  const secret = process.env.MYDATA_UPLOAD_SECRET ?? "";
  if (!secret) return false;
  if (header(req, "x-upload-secret") === secret) return true;
  return header(req, "authorization") === `Bearer ${secret}`;
}

function safeFilename(name) {
  const base = name
    .replace(/^.*[/\\]/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 200);
  return base || "upload.bin";
}

function keyPrefix() {
  const raw = process.env.DO_SPACES_KEY_PREFIX ?? "savedUploads";
  return raw.replace(/^\/+/, "").replace(/\/+$/, "");
}

async function readMultipart(req) {
  const ct = header(req, "content-type");
  if (!ct?.includes("multipart/form-data")) return null;

  return new Promise((resolve, reject) => {
    const bb = busboy({ headers: req.headers });
    let settled = false;

    bb.on("file", (fieldname, file, info) => {
      if (fieldname !== "file") {
        file.resume();
        return;
      }
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({
          buffer: Buffer.concat(chunks),
          filename: safeFilename(info.filename || "upload.bin"),
          contentType: info.mimeType || "application/octet-stream",
        });
      });
    });

    bb.on("error", (err) => {
      if (!settled) reject(err);
    });

    bb.on("finish", () => {
      if (!settled) resolve(null);
    });

    req.pipe(bb);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  applyCors(res, req);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    log("reject method=", req.method);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secretConfigured = Boolean(process.env.MYDATA_UPLOAD_SECRET ?? "");
  if (!authOk(req)) {
    logError(
      "unauthorized",
      secretConfigured
        ? "bad or missing X-Upload-Secret / Authorization Bearer"
        : "MYDATA_UPLOAD_SECRET is not set on the server",
    );
    res.status(401).json({
      error: "Unauthorized",
      hint: secretConfigured
        ? "Send X-Upload-Secret or Authorization: Bearer <MYDATA_UPLOAD_SECRET>"
        : "Set MYDATA_UPLOAD_SECRET in Vercel env or .env for vercel dev",
    });
    return;
  }

  const accessKeyId = process.env.DO_SPACES_ACCESS_KEY ?? "";
  const secretAccessKey = process.env.DO_SPACES_SECRET_KEY ?? "";
  const endpoint =
    process.env.DO_SPACES_ENDPOINT ?? "https://sgp1.digitaloceanspaces.com";
  const bucket = process.env.DO_SPACES_BUCKET ?? "walletchat-pfp-storage";
  const signingRegion =
    process.env.DO_SPACES_SIGNING_REGION ?? "us-east-1";
  const datacenterMatch = endpoint.match(
    /https?:\/\/([a-z0-9-]+)\.digitaloceanspaces\.com\/?$/i,
  );
  const datacenter =
    process.env.DO_SPACES_DATACENTER ?? datacenterMatch?.[1] ?? "sgp1";

  if (!accessKeyId || !secretAccessKey) {
    logError("missing DO_SPACES_ACCESS_KEY or DO_SPACES_SECRET_KEY");
    res.status(500).json({
      error:
        "Server misconfiguration: set DO_SPACES_ACCESS_KEY and DO_SPACES_SECRET_KEY",
    });
    return;
  }

  const rawCt = header(req, "content-type") ?? "";

  log("request", {
    contentType: rawCt.slice(0, 120) + (rawCt.length > 120 ? "…" : ""),
    multipart: rawCt.includes("multipart/form-data"),
  });
  log("spaces target", {
    endpoint,
    bucket,
    signingRegion,
    datacenter,
    keyPrefix: keyPrefix(),
  });

  let buffer;
  let filename;
  let contentType;

  try {
    const multipart = await readMultipart(req);
    if (rawCt.includes("multipart/form-data")) {
      if (!multipart) {
        logError('multipart parse failed or missing field "file"');
        res.status(400).json({ error: 'Expected multipart field "file"' });
        return;
      }
      buffer = multipart.buffer;
      filename = multipart.filename;
      contentType = multipart.contentType;
    } else {
      buffer = await readRawBody(req);
      if (buffer.length === 0) {
        logError("raw body empty (check Content-Type and body)");
        res.status(400).json({ error: "Empty body" });
        return;
      }
      filename = safeFilename(header(req, "x-filename") ?? "upload.bin");
      const semi = rawCt.indexOf(";");
      contentType =
        (semi >= 0 ? rawCt.slice(0, semi) : rawCt).trim() ||
        "application/octet-stream";
    }
  } catch (parseErr) {
    logError("body read/parse error", parseErr);
    res.status(400).json({
      error: "Could not read request body",
      detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
    });
    return;
  }

  const objectName = `${randomUUID()}-${filename}`;
  const prefix = keyPrefix();
  const key = prefix ? `${prefix}/${objectName}` : objectName;

  log("parsed body", {
    filename,
    contentType,
    bytes: buffer.length,
    key,
  });

  const s3 = new S3Client({
    region: signingRegion,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  try {
    const out = await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    log("PutObject ok", {
      key,
      bucket,
      etag: out.ETag,
      versionId: out.VersionId,
    });
  } catch (e) {
    const details = awsErrorDetails(e);
    logError("PutObject failed", details, e);
    const message =
      e instanceof Error ? e.message : "Upload to Spaces failed";
    res.status(500).json({
      error: message,
      spacesError: details,
    });
    return;
  }

  const publicBase =
    process.env.DO_SPACES_PUBLIC_BASE ??
    `https://${bucket}.${datacenter}.digitaloceanspaces.com`;

  const publicUrl = `${publicBase.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;

  log("success", { key, publicUrl });

  res.status(201).json({
    ok: true,
    bucket,
    key,
    publicUrl,
    message:
      "Object written in Spaces. If the UI is empty, confirm bucket name and datacenter in logs match the Space you are viewing.",
  });
}
