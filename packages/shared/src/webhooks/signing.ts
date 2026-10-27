// HMAC-SHA256 webhook signing with Web Crypto, so the same code runs in Node, Next.js route
// handlers and Supabase Edge Functions (Deno).

export const EVENT_ID_HEADER = "x-wfh-event-id";
export const TIMESTAMP_HEADER = "x-wfh-timestamp";
export const SIGNATURE_HEADER = "x-wfh-signature";

/** Reject webhooks whose timestamp is further than this from now. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns the X-WFH-Signature value for a raw request body. */
export async function signWebhook(secret: string, timestampSeconds: number, rawBody: string): Promise<string> {
  return `sha256=${await hmacHex(secret, `${timestampSeconds}.${rawBody}`)}`;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "stale_timestamp" | "bad_signature" };

export async function verifyWebhook(input: {
  secret: string;
  rawBody: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  nowSeconds?: number;
}): Promise<VerifyResult> {
  const { timestampHeader, signatureHeader } = input;
  if (!timestampHeader || !signatureHeader) return { ok: false, reason: "missing_headers" };

  const ts = Number(timestampHeader);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const expected = await signWebhook(input.secret, ts, input.rawBody);
  return timingSafeEqual(expected, signatureHeader) ? { ok: true } : { ok: false, reason: "bad_signature" };
}
