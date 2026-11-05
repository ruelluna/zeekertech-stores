import { Suspense } from "react";
import { formatManilaTime, manilaParts, type ModifierSelection } from "@wfh/shared";
import { ActionForm } from "@/components/action-form";
import { LiveOrders } from "@/components/live";
import { PhoneAlerts } from "@/components/phone-alerts";
import { AutoPrintToggle, PrintButtons } from "@/components/print-controls";
import { Badge, Card, Field, Input, Loading, PageHeader, PesoInput, Select, peso } from "@/components/ui";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { loadInventory } from "@/lib/inventory";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { advanceOrder, markPaid, reviewPayment, staffCancelOrder, submitAvailability } from "./actions";

export default function OrdersPage() {
  return (
    <>
      <PageHeader
        title="Orders"
        description="Updates live. Actions here reach the customer's order page right away."
        actions={
          <Link href="/admin/orders/new" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
            New order
          </Link>
        }
      />
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
  collect_payment: "Collect payment",
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
       payment_reference_no, payment_sender_name, payment_amount_claimed, payment_proof_path, created_at, updated_at, parent_order_id,
       order_items(id, name, qty, unit_price, estimated_unit_price, weight_kg, modifiers, notes, needs_availability, price_mode, item_status, sort_order, brand,
         order_item_availability(status, final_unit_price, note))`,
    )
    .or(`status.not.in.(delivered,picked_up,completed,denied,rejected,cancelled,expired),updated_at.gte.${since}`)
    .order("scheduled_for");
  if (error) throw error;

  const toBuy = (await loadInventory(supabase, manilaParts(new Date()).dateKey)).filter((r) => r.suggestion.status === "buy");

  // Active rider accounts for dispatch (staff_users is owner-only under RLS, so read it server-side).
  const { data: riderRows } = await createSupabaseAdminClient()
    .schema("ops")
    .from("staff_users")
    .select("user_id, display_name")
    .eq("role", "rider")
    .eq("active", true)
    .order("display_name");
  const riders: Rider[] = (riderRows ?? []).map((r) => ({ id: r.user_id, name: r.display_name }));

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
  const canCancel = role !== "kitchen";
  // Add-on orders (items added later) and the orders they belong to.
  const links: OrderLinks = { codes: new Map(orders.map((o) => [o.id, o.queue_code])), addOns: new Map() };
  for (const o of orders) {
    if (o.parent_order_id) links.addOns.set(o.parent_order_id, [...(links.addOns.get(o.parent_order_id) ?? []), o.queue_code]);
  }

  return (
    <>
      <LiveOrders known={Object.fromEntries(orders.map((o) => [o.id, { status: o.status, paymentStatus: o.payment_status, flags: o.flags }]))} />
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
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <AutoPrintToggle />
        <PhoneAlerts />
      </div>
      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        <Badge tone={sourcing.length ? "amber" : "neutral"}>Sourcing {sourcing.length}</Badge>
        <Badge tone={review.length ? "amber" : "neutral"}>Payment review {review.length}</Badge>
        <Badge>Waiting for customer {waiting.length}</Badge>
        <Badge tone={kitchen.length ? "orange" : "neutral"}>Kitchen {kitchen.length}</Badge>
        <Badge>Ready / out {dispatch.length}</Badge>
      </div>

      <Section title="Sourcing" description="Check the seafood and market prices, then send the result to the customer." empty="Nothing to check.">
        {sourcing.map((o) => (
          <OrderCard key={o.id} o={o} canCancel={canCancel} links={links}>
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
          <OrderCard key={o.id} o={o} canCancel={canCancel} links={links}>
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
          <OrderCard key={o.id} o={o} canCancel={canCancel} links={links}>
            <Advance o={o} riders={riders} />
          </OrderCard>
        ))}
      </Section>

      <Section title="Ready & out for delivery" empty="Nothing waiting.">
        {dispatch.map((o) => (
          <OrderCard key={o.id} o={o} canCancel={canCancel} links={links}>
            <Advance o={o} riders={riders} />
          </OrderCard>
        ))}
      </Section>

      <Section title="Waiting for the customer" description="Unpaid orders, or customers reviewing changes after the availability check." empty="None.">
        {waiting.map((o) => (
          <OrderCard key={o.id} o={o} canCancel={canCancel} links={links} />
        ))}
      </Section>

      <Section title="Finished (last 24 hours)" empty="None yet.">
        {finished.map((o) => (
          <OrderCard key={o.id} o={o} canCancel={canCancel} links={links} />
        ))}
      </Section>
    </>
  );
}

type OrderLinks = { codes: Map<string, string>; addOns: Map<string, string[]> };

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
  parent_order_id: string | null;
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
    brand: string | null;
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

function OrderCard({ o, children, canCancel, links }: { o: Order; children?: React.ReactNode; canCancel: boolean; links: OrderLinks }) {
  const parentCode = o.parent_order_id ? (links.codes.get(o.parent_order_id) ?? "an earlier order") : null;
  const addOnCodes = links.addOns.get(o.id) ?? [];
  const canAddItems = !["out_for_delivery", "delivered", "picked_up", "completed", "denied", "rejected", "cancelled", "expired"].includes(o.status);
  const slot = new Date(o.scheduled_for);
  const today = manilaParts(slot).dateKey === manilaParts(new Date()).dateKey;
  const address = o.address as { streetPurok?: string; landmark?: string; riderNotes?: string; lat?: number; lng?: number } | null;
  const terminal = ["delivered", "picked_up", "completed", "denied", "rejected", "cancelled", "expired"].includes(o.status);
  const delivery = o.fulfillment === "delivery";
  const items = [...o.order_items].sort((a, b) => a.sort_order - b.sort_order);
  const payment = PAYMENT_LABEL[o.payment_status] ?? { label: o.payment_status, tone: "neutral" as const };

  return (
    <article className={`rounded-xl border border-l-4 bg-white dark:bg-stone-900 ${STATUS_BADGE[o.status]?.border ?? "border-stone-200 dark:border-stone-700"}`}>
      {/* Who/when: order code and status on the left, pickup/delivery time on the right */}
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 px-3 py-2 dark:border-stone-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold leading-none">{o.queue_code}</span>
          <StatusBadge status={o.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-bold ${delivery ? "bg-orange-600 text-white" : "bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900"}`}>
            {delivery ? "DELIVERY" : "PICKUP"}
          </span>
          <span className={`text-sm font-semibold ${today ? "text-amber-700 dark:text-amber-400" : ""}`}>
            {today ? "Today" : slot.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" })} {formatManilaTime(slot)}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 text-xs text-stone-500">
          <span>{o.external_id ?? "Walk-in"}</span>
          {parentCode && <Badge tone="orange">ADD-ON to {parentCode}</Badge>}
          {addOnCodes.map((code) => (
            <Badge key={code} tone="orange">
              + add-on {code}
            </Badge>
          ))}
          {o.flags.map((f) => (
            <Badge key={f} tone="red">
              {FLAG_TEXT[f] ?? f}
            </Badge>
          ))}
        </div>
      </header>

      <div className="grid gap-4 p-3 sm:grid-cols-[1fr_15rem]">
        {/* What to make: the items, front and center */}
        <ul className="flex flex-col gap-2">
          {items.map((i) => {
            const mods = (i.modifiers as ModifierSelection[]).map((m) => m.option);
            const removed = i.item_status === "removed" || i.order_item_availability?.status === "cant_source";
            return (
              <li key={i.id} className={`flex gap-3 ${removed ? "opacity-50" : ""}`}>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-orange-100 px-2 text-base font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-200">
                  {i.qty}×
                </span>
                <div className="min-w-0">
                  <p className={`text-base font-semibold leading-tight ${removed ? "line-through" : ""}`}>
                    {i.name}
                    {i.weight_kg ? <span className="font-normal"> · {i.weight_kg} kg</span> : null}
                    {removed && <span className="ml-2 text-xs font-normal text-red-700 no-underline dark:text-red-400">not available</span>}
                  </p>
                  {i.brand && (
                    <span className="mt-0.5 inline-block">
                      <Badge tone="pink">{i.brand}</Badge>
                    </span>
                  )}
                  {mods.length > 0 && <p className="text-sm text-stone-600 dark:text-stone-300">{mods.join(" · ")}</p>}
                  {i.notes && (
                    <p className="mt-0.5 inline-block whitespace-pre-line rounded bg-amber-100 px-1.5 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">“{i.notes}”</p>
                  )}
                </div>
              </li>
            );
          })}
          {o.notes && <li className="whitespace-pre-line rounded-lg bg-stone-100 p-2 text-sm dark:bg-stone-800">📝 {o.notes}</li>}
        </ul>

        {/* Customer, address and payment */}
        <aside className="flex flex-col gap-3 text-sm sm:border-l sm:border-stone-100 sm:pl-4 dark:sm:border-stone-800">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Customer</p>
            <p className="font-semibold">{o.customer_name ?? "—"}</p>
            {o.customer_phone && (
              <a href={`tel:${o.customer_phone}`} className="text-orange-700 underline">
                {o.customer_phone}
              </a>
            )}
          </div>
          {delivery && address && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Deliver to</p>
              <p>{[address.streetPurok, o.barangay].filter(Boolean).join(", ")}</p>
              {address.landmark && <p className="text-stone-600 dark:text-stone-400">Near {address.landmark}</p>}
              <p className="text-stone-600 dark:text-stone-400">
                {o.distance_km !== null && `${o.distance_km} km`}
                {address.lat !== undefined && (
                  <>
                    {o.distance_km !== null && " · "}
                    <a href={`https://www.google.com/maps?q=${address.lat},${address.lng}`} target="_blank" rel="noreferrer" className="text-orange-700 underline">
                      Map
                    </a>
                  </>
                )}
              </p>
              {address.riderNotes && <p className="text-xs text-stone-500">Rider notes: {address.riderNotes}</p>}
              {o.rider_name && <p className="text-xs text-stone-500">Rider: {o.rider_name}</p>}
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Payment</p>
            <p className="text-lg font-bold leading-tight">
              {o.is_estimate ? "~" : ""}
              {peso(o.total)}
            </p>
            {(delivery || o.discount_amount > 0) && (
              <p className="text-xs text-stone-500">
                {delivery && `incl. delivery ${peso(o.delivery_fee)}`}
                {delivery && o.discount_amount > 0 && " · "}
                {o.discount_amount > 0 && `discount ${peso(o.discount_amount)}`}
              </p>
            )}
            <span className="mt-1 inline-block">
              <Badge tone={payment.tone}>{payment.label}</Badge>
            </span>
          </div>
        </aside>
      </div>

      {/* Actions */}
      <footer className="flex flex-col gap-3 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
        {children}
        {o.flags.includes("collect_payment") && o.payment_status !== "confirmed" && !terminal && (
          <ActionForm action={markPaid} submitLabel={`Mark paid (${peso(o.total)} collected)`} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="orderId" value={o.id} />
          </ActionForm>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <PrintButtons orderId={o.id} />
            {canAddItems && (
              <Link
                href={`/admin/orders/new?addTo=${o.id}`}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium hover:border-orange-500 dark:border-stone-700"
              >
                + Add items
              </Link>
            )}
          </div>
          {!terminal && canCancel && (
            <details className="text-sm">
              <summary className="cursor-pointer text-stone-500">Cancel order…</summary>
              <ActionForm action={staffCancelOrder} submitLabel="Cancel order" danger className="mt-2 flex flex-wrap items-end gap-3">
                <input type="hidden" name="orderId" value={o.id} />
                <Field label="Reason (customer sees it)" className="w-72">
                  <Input name="reason" required />
                </Field>
              </ActionForm>
            </details>
          )}
        </div>
      </footer>
    </article>
  );
}

const PAYMENT_LABEL: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "orange" }> = {
  not_requested: { label: "Pays after confirmation", tone: "neutral" },
  awaiting_payment: { label: "Not paid yet", tone: "amber" },
  submitted: { label: "Payment sent: check GCash", tone: "amber" },
  partial: { label: "Partly paid", tone: "red" },
  confirmed: { label: "Paid", tone: "green" },
  rejected: { label: "Payment rejected", tone: "red" },
};

const STATUS_BADGE: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "orange"; border?: string }> = {
  awaiting_availability: { label: "Checking availability", tone: "amber" },
  awaiting_customer: { label: "Waiting for customer", tone: "neutral" },
  pending_payment: { label: "Awaiting payment", tone: "amber" },
  queued: { label: "In queue", tone: "orange" },
  preparing: { label: "Preparing", tone: "orange" },
  ready: { label: "Ready", tone: "green" },
  out_for_delivery: { label: "Out for delivery", tone: "orange" },
  picked_up: { label: "✓ Picked up", tone: "green", border: "border-stone-200 border-l-green-600 dark:border-stone-700 dark:border-l-green-500" },
  delivered: { label: "✓ Delivered", tone: "green", border: "border-stone-200 border-l-green-600 dark:border-stone-700 dark:border-l-green-500" },
  completed: { label: "✓ Completed", tone: "green", border: "border-stone-200 border-l-green-600 dark:border-stone-700 dark:border-l-green-500" },
  cancelled: { label: "✕ Cancelled", tone: "red", border: "border-stone-200 border-l-red-600 dark:border-stone-700 dark:border-l-red-500" },
  expired: { label: "✕ Expired", tone: "red", border: "border-stone-200 border-l-red-600 dark:border-stone-700 dark:border-l-red-500" },
  denied: { label: "✕ Couldn't source", tone: "red", border: "border-stone-200 border-l-red-600 dark:border-stone-700 dark:border-l-red-500" },
  rejected: { label: "✕ Payment rejected", tone: "red", border: "border-stone-200 border-l-red-600 dark:border-stone-700 dark:border-l-red-500" },
};

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] ?? { label: status.replaceAll("_", " "), tone: "neutral" as const };
  return (
    <span className="text-sm">
      <Badge tone={b.tone}>{b.label}</Badge>
    </span>
  );
}

type Rider = { id: string; name: string };

function Advance({ o, riders }: { o: Order; riders: Rider[] }) {
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
                  <>
                    <Field label="Rider" className="w-44">
                      <Select name="riderId" defaultValue={riders[0]?.id ?? "other"}>
                        {riders.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                        <option value="other">Someone else…</option>
                      </Select>
                    </Field>
                    <Field label="Name (if someone else)" className="w-40">
                      <Input name="riderName" placeholder="Name" />
                    </Field>
                  </>,
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
