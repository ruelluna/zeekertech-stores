import "server-only";
import { z } from "zod";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyWebhook } from "@wfh/shared";

/** Verifies the signature and parses the body. Returns a Response to send back on failure. */
export async function readSignedEvent<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ ok: true; event: z.infer<T> } | { ok: false; response: Response }> {
  const secret = process.env.WEBHOOK_SIGNING_SECRET;
  if (!secret) return { ok: false, response: Response.json({ error: "not configured" }, { status: 500 }) };

  const rawBody = await request.text();
  const verified = await verifyWebhook({
    secret,
    rawBody,
    timestampHeader: request.headers.get(TIMESTAMP_HEADER),
    signatureHeader: request.headers.get(SIGNATURE_HEADER),
  });
  if (!verified.ok) return { ok: false, response: Response.json({ error: verified.reason }, { status: 401 }) };

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, response: Response.json({ error: "invalid json" }, { status: 400 }) };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: Response.json({ error: "invalid event", issues: parsed.error.issues.slice(0, 5) }, { status: 400 }) };
  }
  return { ok: true, event: parsed.data };
}
