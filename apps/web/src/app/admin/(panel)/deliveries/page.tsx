import { Suspense } from "react";
import { formatManilaTime, manilaInstant, manilaParts, type ModifierSelection } from "@wfh/shared";
import { ActionForm } from "@/components/action-form";
import { LiveDeliveries } from "@/components/live";
import { Badge, Card, Loading, PageHeader, peso } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { markDelivered } from "./actions";

export default function DeliveriesPage() {
  return (
    <>
      <PageHeader title="My deliveries" description="Updates live. Tap Delivered once the customer has their order." />
      <Suspense fallback={<Loading />}>
        <Deliveries />
      </Suspense>
    </>
  );
}

type Delivery = {
  id: string;
  queue_code: string;
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  address: unknown;
  barangay: string | null;
  lat: number | null;
  lng: number | null;
  total: number;
  payment_status: string;
  flags: string[];
  rider_name: string | null;
  rider_pay: number | null;
  rider_paid_out_at: string | null;
  completed_at: string | null;
  scheduled_for: string;
  parent_order_id: string | null;
  order_items: { id: string; name: string; qty: number; modifiers: unknown; item_status: string }[];
};

async function Deliveries() {
  const { supabase, role, storeId } = await requireStaff(["rider", "owner"]);
  const startOfToday = manilaInstant(manilaParts(new Date()).dateKey, 0).toISOString();

  // Row-level security limits riders to their own deliveries; the owner sees every rider's.
  const { data, error } = await supabase
    .schema("ops")
    .from("orders")
    .select(
      `id, queue_code, status, customer_name, customer_phone, address, barangay, lat, lng, total, payment_status, flags,
       rider_name, rider_pay, rider_paid_out_at, completed_at, scheduled_for, parent_order_id,
       order_items(id, name, qty, modifiers, item_status)`,
    )
    .eq("store_id", storeId)
    .not("rider_name", "is", null)
    .or(`status.eq.out_for_delivery,completed_at.gte.${startOfToday},and(status.eq.delivered,rider_paid_out_at.is.null)`)
    .order("scheduled_for");
  if (error) throw error;
  const deliveries = data as Delivery[];

  const onTheWay = deliveries.filter((d) => d.status === "out_for_delivery");
  const doneToday = deliveries.filter((d) => d.status === "delivered" && d.completed_at && d.completed_at >= startOfToday);
  const unpaid = deliveries.filter((d) => d.status === "delivered" && !d.rider_paid_out_at);
  const sum = (list: Delivery[]) => list.reduce((s, d) => s + Number(d.rider_pay ?? 0), 0);

  return (
    <>
      <LiveDeliveries known={Object.fromEntries(deliveries.map((d) => [d.id, d.status]))} />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ink-200 bg-surface p-4 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-xs uppercase tracking-wide text-muted">Earned today</p>
          <p className="text-2xl font-bold">{peso(sum(doneToday))}</p>
          <p className="text-xs text-muted">
            {doneToday.length} deliver{doneToday.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-surface p-4 dark:border-ink-800 dark:bg-ink-900">
          <p className="text-xs uppercase tracking-wide text-muted">Not paid out yet</p>
          <p className="text-2xl font-bold">{peso(sum(unpaid))}</p>
          <p className="text-xs text-muted">Paid out by the owner</p>
        </div>
      </div>

      <Card title={`On the way (${onTheWay.length})`}>
        {onTheWay.length === 0 ? (
          <p className="text-sm text-muted">No deliveries right now. New ones appear here automatically.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {onTheWay.map((d) => (
              <DeliveryCard key={d.id} d={d} showRider={role === "owner"} />
            ))}
          </div>
        )}
      </Card>

      <Card title={`Delivered today (${doneToday.length})`}>
        {doneToday.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
            {doneToday.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <strong>{d.queue_code}</strong> · {d.customer_name} · {d.barangay}
                  {role === "owner" && d.rider_name ? <span className="text-muted"> · {d.rider_name}</span> : null}
                </span>
                <span className="font-semibold">{peso(d.rider_pay)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function DeliveryCard({ d, showRider }: { d: Delivery; showRider: boolean }) {
  const address = d.address as { streetPurok?: string; landmark?: string; riderNotes?: string; lat?: number; lng?: number } | null;
  const lat = address?.lat ?? d.lat;
  const lng = address?.lng ?? d.lng;
  const collect = d.flags.includes("collect_payment") && d.payment_status !== "confirmed";
  const unpaid = d.payment_status !== "confirmed";

  return (
    <article className="rounded-xl border border-ink-200 p-3 dark:border-ink-700">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-2xl font-bold">{d.queue_code}</span>
        <span className="text-sm font-semibold">{formatManilaTime(new Date(d.scheduled_for))}</span>
      </header>
      {d.parent_order_id && <Badge tone="orange">Add-on: deliver with the main order</Badge>}

      <p className="mt-1 text-lg font-semibold">{d.customer_name ?? "Customer"}</p>
      <p>{[address?.streetPurok, d.barangay].filter(Boolean).join(", ")}</p>
      {address?.landmark && <p className="text-muted">Near {address.landmark}</p>}
      {address?.riderNotes && <p className="mt-1 rounded bg-amber-100 px-2 py-1 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{address.riderNotes}</p>}

      <div className="my-3 flex flex-wrap gap-2">
        {d.customer_phone && (
          <a href={`tel:${d.customer_phone}`} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">
            📞 Call {d.customer_phone}
          </a>
        )}
        {lat != null && lng != null && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            🧭 Directions
          </a>
        )}
      </div>

      <ul className="mb-3 text-sm">
        {d.order_items
          .filter((i) => i.item_status !== "removed")
          .map((i) => (
            <li key={i.id}>
              {i.qty}× {i.name}
              {(i.modifiers as ModifierSelection[]).length > 0 && (
                <span className="text-muted"> · {(i.modifiers as ModifierSelection[]).map((m) => m.option).join(", ")}</span>
              )}
            </li>
          ))}
      </ul>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {collect ? (
          <span className="rounded-lg bg-amber-500 px-3 py-1.5 text-base font-bold text-white">Collect {peso(d.total)}</span>
        ) : unpaid ? (
          <Badge tone="amber">Not paid: check with the store</Badge>
        ) : (
          <Badge tone="green">Paid</Badge>
        )}
        {d.rider_pay != null && <span className="text-sm text-muted">Your pay: {peso(d.rider_pay)}</span>}
        {showRider && d.rider_name && <span className="text-sm text-muted">· Rider: {d.rider_name}</span>}
      </div>

      <ActionForm action={markDelivered} submitLabel={collect ? `Delivered · ${peso(d.total)} collected` : "Delivered"}>
        <input type="hidden" name="orderId" value={d.id} />
      </ActionForm>
    </article>
  );
}
