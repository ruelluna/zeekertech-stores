import { OpsToWebEvent } from "@wfh/shared";
import { ingestOpsEvent } from "@/lib/webhooks/ingest-web";
import { readSignedEvent } from "@/lib/webhooks/receive";

/** Website: receives ordering-backend events (status changes, availability results, menu badges). */
export async function POST(request: Request) {
  const read = await readSignedEvent(request, OpsToWebEvent);
  if (!read.ok) return read.response;
  try {
    await ingestOpsEvent(read.event);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[webhooks/ops]", read.event.event, e);
    return Response.json({ error: "processing failed" }, { status: 500 });
  }
}
