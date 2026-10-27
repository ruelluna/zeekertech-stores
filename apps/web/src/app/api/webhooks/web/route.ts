import { WebToOpsEvent } from "@wfh/shared";
import { ingestWebEvent } from "@/lib/webhooks/ingest-ops";
import { readSignedEvent } from "@/lib/webhooks/receive";

/** Ordering backend: receives website events (new orders, payments, customer decisions). */
export async function POST(request: Request) {
  const read = await readSignedEvent(request, WebToOpsEvent);
  if (!read.ok) return read.response;
  try {
    await ingestWebEvent(read.event);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[webhooks/web]", read.event.event, e);
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
