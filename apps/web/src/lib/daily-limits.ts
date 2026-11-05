import "server-only";
import { addDays, manilaParts, type BookedQty } from "@wfh/shared";
import { createSupabaseAdminClient } from "./supabase/admin";

/**
 * How many of each product are already booked per Manila date, from today for `days` days
 * (store.booked_qty: website orders the moment they're placed, plus walk-in, phone and Messenger orders).
 * Fresh on every call: it decides whether a day still has room.
 */
export async function fetchBookedQty(storeId: string, days = 30): Promise<BookedQty> {
  const from = manilaParts(new Date()).dateKey;
  const { data, error } = await createSupabaseAdminClient()
    .schema("store")
    .rpc("booked_qty", { p_store: storeId, p_from: from, p_to: addDays(from, days) });
  if (error) throw error;
  const booked: BookedQty = {};
  for (const row of data ?? []) (booked[row.sku] ??= {})[row.day] = Number(row.qty);
  return booked;
}
