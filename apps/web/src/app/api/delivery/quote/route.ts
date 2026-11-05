import { fetchCatalog } from "@/lib/catalog";
import { quoteDelivery } from "@/lib/delivery";
import { QuoteInput } from "@/app/s/[store]/checkout/schema";

/** Delivery fee preview for the checkout map. The fee is recalculated when the order is placed. */
export async function POST(request: Request) {
  const parsed = QuoteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid location" }, { status: 400 });
  const catalog = await fetchCatalog(parsed.data.storeId);
  if (!catalog.delivery.enabled) return Response.json({ ok: false, error: "This store is pickup only." });
  const result = await quoteDelivery(catalog, parsed.data);
  return Response.json(result);
}
