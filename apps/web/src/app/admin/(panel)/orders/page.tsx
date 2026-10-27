import { Suspense } from "react";
import { formatManilaTime, manilaParts, type ModifierSelection } from "@wfh/shared";
import { ActionForm } from "@/components/action-form";
import { AutoRefresh } from "@/components/live";
import { Badge, Card, Field, Input, Loading, PageHeader, PesoInput, peso } from "@/components/ui";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { loadInventory } from "@/lib/inventory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { advanceOrder, reviewPayment, staffCancelOrder, submitAvailability } from "./actions";

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Updates every 15 seconds. Actions here reach the customer's order page right away." />
      <Suspense fallback={<Loading />}>
        <Orders />
      </Suspense>
    </>
  );
}

const FLAG_TEXT: Record<string, string> = {
  possible_duplicate_discount: "Possible repeat welcome discount",
  duplicate_reference_no: "GCash reference used on another order",
  estimated_distance: "Distance estimated (straight line)",
  unpaid_overdue: "Unpaid for a while",
  customer_asked_to_cancel: "Customer asked to cancel",
};

/** ISO time N hours ago (runs per request: the page is dynamic). */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

async function Orders() {
  const { supabase, role } = await requireStaff();
  const ops = supabase.schema("ops");
  const since = hoursAgo(24);

  const { data: orders, error } = await ops
    .from("orders")
    .select(
      `id, queue_code, external_id, source, status, payment_status, fulfillment, scheduled_for, customer_name, customer_phone,
       barangay, address, distance_km, delivery_fee, subtotal, discount_amount, total, is_estimate, flags, rider_name, notes,
       payment_reference_no, payment_sender_name, payment_amount_claimed, payment_proof_path, created_at, updated_at,
       order_items(id, name, qty, unit_price, estimated_unit_price, weight_kg, modifiers, notes, needs_availability, price_mode, item_status, sort_order,
         order_item_availability(status, final_unit_price, note))`,
    )
    .or(`status.not.in.(delivered,picked_up,completed,denied,rejected,cancelled,expired),updated_at.gte.${since}`)
    .order("scheduled_for");
  if (error) throw error;

  const toBuy = (await loadInventory(supabase, manilaParts(new Date()).dateKey)).filter((r) => r.suggestion.status === "buy");

  // Signed links to GCash screenshots (private bucket), valid for 10 minutes.
  const proofUrls = new Map<string, string>();
  const withProof = orders.filter((o) => o.payment_proof_path && o.status === "pending_payment");
  if (withProof.length) {
    const storage = createSupabaseAdminClient().storage.from("payment-proofs");
    await Promise.all(
      withProof.map(async (o) => {
        const { data } = await storage.createSignedUrl(o.payment_proof_path!, 600);
        if (data) proofUrls.set(o.id, data.signedUrl);
      }),
    );
  }

  const by = (statuses: string[]) => orders.filter((o) => statuses.includes(o.status));
  const sourcing = by(["awaiting_availability"]);
  const review = orders.filter((o) => o.status === "pending_payment" && o.payment_status === "submitted");
  const waiting = orders.filter((o) => (o.status === "pending_payment" && o.payment_status !== "submitted") || o.status === "awaiting_customer");
  const kitchen = by(["queued", "preparing"]);
  const dispatch = by(["ready", "out_for_delivery"]);
  const finished = by(["delivered", "picked_up", "completed", "denied", "rejected", "cancelled", "expired"]);
  const canReview = role === "owner" || role === "verifier";

  return (
    <>
      <AutoRefresh active />
      {toBuy.length > 0 && (
        <Link
          href="/admin/inventory"
          className="mb-4 block rounded-xl bg-amber-50 p-3 text-sm text-amber-900 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200"
        >
          🛒 <strong>{toBuy.length} item{toBuy.length === 1 ? "" : "s"} to buy:</strong>{" "}
          {toBuy.slice(0, 5).map((r) => `${r.name} (${r.suggestion.quantity} ${r.unit})`).join(", ")}
          {toBuy.length > 5 ? "…" : ""} →
        </Link>
      )}
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Badge tone={sourcing.length ? "amber" : "neutral"}>Sourcing {sourcing.length}</Badge>
        <Badge tone={review.length ? "amber" : "neutral"}>Payment review {review.length}</Badge>
        <Badge>Waiting for customer {waiting.length}</Badge>
        <Badge tone={kitchen.length ? "orange" : "neutral"}>Kitchen {kitchen.length}</Badge>
        <Badge>Ready / out {dispatch.length}</Badge>
      </div>

      <Section title="Sourcing" description="Check the seafood and market prices, then send the result to the customer." empty="Nothing to check.">
        {sourcing.map((o) => (
          <OrderCard key={o.id} o={o}>
            <ActionForm action={submitAvailability} submitLabel="Send result to customer">
              <input type="hidden" name="orderId" value={o.id} />
              {o.order_items
                .filter((i) => i.needs_availability && i.item_status !== "removed")
                .map((i) => (
                  <fieldset key={i.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                    <input type="hidden" name="itemId" value={i.id} />
                    <input type="hidden" name={`market_${i.id}`} value={i.price_mode === "market" ? "1" : "0"} />
                    <legend className="px-1 text-sm font-medium">
                      {i.qty}× {i.name}
                      {i.weight_kg ? ` (${i.weight_kg} kg)` : ""}
                      {i.price_mode === "market" && ` · estimate ${peso(i.estimated_unit_price)}`}
                    </legend>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`status_${i.id}`} value="ready_to_cook" required className="accent-green-600" /> Ready to cook
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`status_${i.id}`} value="cant_source" className="accent-red-600" /> Can&apos;t source
                      </label>
                      {i.price_mode === "market" && (
                        <Field label="Final price (each)" className="w-36">
                          <PesoInput name={`price_${i.id}`} defaultValue={i.estimated_unit_price} />
                        </Field>
                      )}
                      <Field label="Note for customer (optional)" className="min-w-48 flex-1">
                        <Input name={`note_${i.id}`} placeholder="e.g. no shrimp at the market today" />
                      </Field>
                    </div>
                  </fieldset>
                ))}
            </ActionForm>
          </OrderCard>
        ))}
      </Section>

      <Section title="Payment review" description="Check GCash for the reference number and amount before confirming." empty="No payments to check.">
        {review.map((o) => (
          <OrderCard key={o.id} o={o}>
            <dl className="mb-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Info label="Amount due" value={peso(o.total)} strong />
              <Info
                label="Customer says they paid"
                value={peso(o.payment_amount_claimed)}
                warn={o.payment_amount_claimed !== null && Number(o.payment_amount_claimed) !== Number(o.total)}
              />
              <Info label="GCash reference" value={o.payment_reference_no ?? "—"} strong />
              <Info label="Sender name" value={o.payment_sender_name ?? "—"} />
            </dl>
            {proofUrls.get(o.id) && (
              <a href={proofUrls.get(o.id)} target="_blank" rel="noreferrer" className="mb-3 inline-block text-sm text-orange-700 underline">
                View payment screenshot
              </a>
            )}
            {canReview ? (
              <div className="flex flex-wrap items-end gap-4">
                <ActionForm action={reviewPayment} submitLabel="Confirm payment" className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="hidden" name="decision" value="confirmed" />
                  <Field label="Amount received" className="w-36">
                    <PesoInput name="amount" defaultValue={o.total} />
                  </Field>
                </ActionForm>
                <ActionForm action={reviewPayment} submitLabel="Reject" danger className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="orderId" value={o.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <Field label="Reason (customer sees it)" className="w-64">
                    <Input name="reason" placeholder="e.g. payment not found in GCash" />
                  </Field>
                </ActionForm>
              </div>
            ) : (
              <p className="text-sm text-stone-500">Only the owner or a verifier can confirm payments.</p>
            )}
          </OrderCard>
        ))}
      </Section>

      <Section title="Kitchen" description="Paid orders, in pickup/delivery time order." empty="Nothing to cook right now.">
        {kitchen.map((o) => (
          <OrderCard key={o.id} o={o}>
            <Advance o={o} />
          </OrderCard>
        ))}
      </Section>

      <Section title="Ready & out for delivery" empty="Nothing waiting.">
        {dispatch.map((o) => (
          <OrderCard key={o.id} o={o}>
            <Advance o={o} />
          </OrderCard>
        ))}
      </Section>

      <Section title="Waiting for the customer" description="Unpaid orders, or customers reviewing changes after the availability check." empty="None.">
        {waiting.map((o) => (
          <OrderCard key={o.id} o={o} />
        ))}
      </Section>

      <Section title="Finished (last 24 hours)" empty="None yet.">
        {finished.map((o) => (
          <OrderCard key={o.id} o={o} compact />
        ))}
      </Section>
    </>
  );
}

type Order = {
  id: string;
  queue_code: string;
  external_id: string | null;
  status: string;
  payment_status: string;
  fulfillment: string;
  scheduled_for: string;
  customer_name: string | null;
  customer_phone: string | null;
  barangay: string | null;
  address: unknown;
  distance_km: number | null;
  delivery_fee: number;
  discount_amount: number;
  total: number;
  is_estimate: boolean;
  flags: string[];
  rider_name: string | null;
  notes: string | null;
  order_items: {
    id: string;
    name: string;
    qty: number;
    unit_price: number | null;
    estimated_unit_price: number | null;
    weight_kg: number | null;
    modifiers: unknown;
    notes: string;
    item_status: string;
    sort_order: number;
    order_item_availability: { status: string; final_unit_price: number | null; note: string | null } | null;
  }[];
};

function Section({ title, description, empty, children }: { title: string; description?: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card title={`${title} (${children.length})`} description={description}>
      {children.length === 0 ? <p className="text-sm text-stone-500">{empty}</p> : <div className="flex flex-col gap-4">{children}</div>}
    </Card>
  );
}

function OrderCard({ o, children, compact }: { o: Order; children?: React.ReactNode; compact?: boolean }) {
  const slot = new Date(o.scheduled_for);
  const today = manilaParts(slot).dateKey === manilaParts(new Date()).dateKey;
  const address = o.address as { streetPurok?: string; landmark?: string; riderNotes?: string; lat?: number; lng?: number } | null;
  const terminal = ["delivered", "picked_up", "completed", "denied", "rejected", "cancelled", "expired"].includes(o.status);

  return (
    <article className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold">{o.queue_code}</span>
        <Badge tone={o.fulfillment === "delivery" ? "orange" : "neutral"}>{o.fulfillment === "delivery" ? "DELIVERY" : "PICKUP"}</Badge>
        <Badge tone={today ? "amber" : "neutral"}>
          {today ? "Today" : slot.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" })} {formatManilaTime(slot)}
        </Badge>
        <span className="text-sm text-stone-500">
          {o.external_id ?? "Walk-in"} · {o.status.replaceAll("_", " ")}
        </span>
        {o.flags.map((f) => (
          <Badge key={f} tone="red">
            {FLAG_TEXT[f] ?? f}
          </Badge>
        ))}
      </header>

      <p className="text-sm">
        <strong>{o.customer_name ?? "—"}</strong>
        {o.customer_phone && (
          <>
            {" · "}
            <a href={`tel:${o.customer_phone}`} className="text-orange-700 underline">
              {o.customer_phone}
            </a>
          </>
        )}
      </p>
      {o.fulfillment === "delivery" && address && (
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {[address.streetPurok, o.barangay, address.landmark && `near ${address.landmark}`].filter(Boolean).join(", ")}
          {o.distance_km !== null && ` · ${o.distance_km} km`}
          {address.lat !== undefined && (
            <>
              {" · "}
              <a href={`https://www.google.com/maps?q=${address.lat},${address.lng}`} target="_blank" rel="noreferrer" className="text-orange-700 underline">
                Map
              </a>
            </>
          )}
          {address.riderNotes && <span className="block text-xs">Rider notes: {address.riderNotes}</span>}
        </p>
      )}

      {!compact && (
        <ul className="my-2 text-sm">
          {[...o.order_items]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((i) => {
              const mods = (i.modifiers as ModifierSelection[]).map((m) => m.option);
              const removed = i.item_status === "removed" || i.order_item_availability?.status === "cant_source";
              return (
                <li key={i.id} className={removed ? "text-stone-400 line-through" : ""}>
                  {i.qty}× {i.name}
                  {i.weight_kg ? ` (${i.weight_kg} kg)` : ""}
                  {mods.length > 0 && <span className="text-stone-500"> · {mods.join(", ")}</span>}
                  {i.notes && <span className="text-stone-500"> · “{i.notes}”</span>}
                </li>
              );
            })}
        </ul>
      )}

      <p className="mb-2 text-sm">
        Total <strong>{o.is_estimate ? "~" : ""}{peso(o.total)}</strong>
        {o.discount_amount > 0 && <span className="text-stone-500"> (discount {peso(o.discount_amount)})</span>}
        {o.fulfillment === "delivery" && <span className="text-stone-500"> · delivery {peso(o.delivery_fee)}</span>}
        {o.rider_name && <span className="text-stone-500"> · rider {o.rider_name}</span>}
      </p>
      {o.notes && <p className="mb-2 whitespace-pre-line text-xs text-stone-500">{o.notes}</p>}

      {children}

      {!terminal && !compact && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-stone-500">Cancel order…</summary>
          <ActionForm action={staffCancelOrder} submitLabel="Cancel order" danger className="mt-2 flex flex-wrap items-end gap-3">
            <input type="hidden" name="orderId" value={o.id} />
            <Field label="Reason (customer sees it)" className="w-72">
              <Input name="reason" required />
            </Field>
          </ActionForm>
        </details>
      )}
    </article>
  );
}

function Advance({ o }: { o: Order }) {
  const step = (to: string, label: string, extra?: React.ReactNode) => (
    <ActionForm key={to} action={advanceOrder} submitLabel={label} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="orderId" value={o.id} />
      <input type="hidden" name="from" value={o.status} />
      <input type="hidden" name="to" value={to} />
      {extra}
    </ActionForm>
  );
  const steps =
    o.status === "queued"
      ? [step("preparing", "Start preparing")]
      : o.status === "preparing"
        ? [step("ready", "Ready")]
        : o.status === "ready"
          ? o.fulfillment === "delivery"
            ? [
                step(
                  "out_for_delivery",
                  "Out for delivery",
                  <Field label="Rider" className="w-40">
                    <Input name="riderName" placeholder="Name" />
                  </Field>,
                ),
              ]
            : [step("picked_up", "Picked up")]
          : o.status === "out_for_delivery"
            ? [step("delivered", "Delivered")]
            : [];
  return <div className="flex flex-wrap gap-3">{steps}</div>;
}

function Info({ label, value, strong, warn }: { label: string; value: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className={`${strong ? "font-semibold" : ""} ${warn ? "text-red-700 dark:text-red-400" : ""}`}>{value}</dd>
    </div>
  );
}
