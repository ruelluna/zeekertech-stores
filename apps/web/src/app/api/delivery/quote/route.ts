import { fetchCatalog } from "@/lib/catalog";
import { quoteDelivery } from "@/lib/delivery";
import { QuoteInput } from "@/app/checkout/schema";

/** Delivery fee preview for the checkout map. The fee is recalculated when the order is placed. */
export async function POST(request: Request) {
  const parsed = QuoteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid location" }, { status: 400 });
  const result = await quoteDelivery(await fetchCatalog(), parsed.data);
  return Response.json(result);
}
