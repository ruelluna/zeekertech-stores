import Link from "next/link";
import { Suspense } from "react";
import { formatManilaTime } from "@wfh/shared";
import { Badge, Card, Loading, PageHeader, linkClass, peso } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { RemoveOrder, StatusBadge } from "../order-bits";
import { FINISHED_STATUSES, PAYMENT_LABEL, finishedCutoff, owesRider } from "../order-status";

const PAGE_SIZE = 30;

export default function PastOrdersPage({ searchParams }: PageProps<"/admin/orders/past">) {
  return (
    <>
      <PageHeader
        title="Past orders"
        description="Orders that finished more than 24 hours ago, newest first."
        actions={
          <Link href="/admin/orders" className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-medium hover:border-accent dark:border-ink-700">
            Back to Orders
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <PastOrders searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PastOrders({ searchParams }: { searchParams: PageProps<"/admin/orders/past">["searchParams"] }) {
  const { supabase, storeId } = await requireOwner();
  const ops = supabase.schema("ops");
  const before = finishedCutoff();

  const { count, error: countError } = await ops
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .in("status", FINISHED_STATUSES)
    .lt("updated_at", before);
  if (countError) throw countError;
  const total = count ?? 0;

  if (total === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">No past orders yet. Orders move here 24 hours after they finish.</p>
      </Card>
    );
  }

  // Asking for a page past the end is an error from the database, and removing the last order on the last page
  // does exactly that, so a page number that's out of range becomes the nearest real page.
  const lastPage = Math.ceil(total / PAGE_SIZE);
  const page = Math.min(lastPage, Math.max(1, Math.floor(Number((await searchParams).page)) || 1));
  const start = (page - 1) * PAGE_SIZE;

  const { data: orders, error } = await ops
    .from("orders")
    .select("id, queue_code, external_id, status, payment_status, scheduled_for, customer_name, total, rider_id, rider_pay, rider_paid_out_at, order_items(name, qty, item_status, sort_order)")
    .eq("store_id", storeId)
    .in("status", FINISHED_STATUSES)
    .lt("updated_at", before)
    .order("updated_at", { ascending: false })
    .order("id")
    .range(start, start + PAGE_SIZE - 1);
  if (error) throw error;

  return (
    <Card>
      <ul className="divide-y divide-ink-100 dark:divide-ink-800">
        {orders.map((o) => {
          const slot = new Date(o.scheduled_for);
          const payment = PAYMENT_LABEL[o.payment_status] ?? { label: o.payment_status, tone: "neutral" as const };
          const items = o.order_items
            .filter((i) => i.item_status !== "removed")
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((i) => `${i.qty}× ${i.name}`)
            .join(", ");
          return (
            <li key={o.id} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-base">{o.queue_code}</strong>
                <StatusBadge status={o.status} />
                <Badge tone={payment.tone}>{payment.label}</Badge>
                <span className="ml-auto font-semibold">{peso(o.total)}</span>
              </div>
              <p className="text-sm">
                {o.customer_name ?? "Walk-in"} · {slot.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })} {formatManilaTime(slot)}
                {o.external_id && <span className="text-muted"> · {o.external_id}</span>}
              </p>
              {items && <p className="text-sm text-muted">{items}</p>}
              {owesRider(o) ? (
                <p className="text-sm text-muted">
                  To remove this order, first pay the rider on the{" "}
                  <Link href="/admin/staff" className={linkClass}>
                    Staff page
                  </Link>
                  .
                </p>
              ) : (
                <RemoveOrder orderId={o.id} queueCode={o.queue_code} />
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted">
          {start + 1}–{start + orders.length} of {total}
        </span>
        <span className="flex gap-2">
          {page > 1 && (
            <Link href={page === 2 ? "/admin/orders/past" : `/admin/orders/past?page=${page - 1}`} className="rounded-lg border border-ink-300 px-3 py-1.5 dark:border-ink-700">
              ← Newer
            </Link>
          )}
          {page < lastPage && (
            <Link href={`/admin/orders/past?page=${page + 1}`} className="rounded-lg border border-ink-300 px-3 py-1.5 dark:border-ink-700">
              Older →
            </Link>
          )}
        </span>
      </div>
    </Card>
  );
}
