import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TERMINAL_ORDER_STATUSES, formatManilaTime, manilaParts, type OrderStatus } from "@wfh/shared";
import { ActionForm } from "@/components/action-form";
import { ContactLink } from "@/components/contact-link";
import { Badge, Loading, peso } from "@/components/ui";
import { fetchCatalog } from "@/lib/catalog";
import { getStoreById, storePath } from "@/lib/stores";
import { STATUS_TEXT } from "@/lib/order-status";
import { loadWebOrderByToken, revisedOrder } from "@/lib/web-order";
import { cancelOrder, decide, submitPayment } from "./actions";
import { LiveOrder, NotifyButton } from "@/components/live";

export const metadata = { title: "Your order", robots: { index: false } };

export default function OrderPage({ params }: PageProps<"/o/[token]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
      <Suspense fallback={<Loading />}>
        <Order params={params} />
      </Suspense>
    </main>
  );
}

const STEPS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "confirm", label: "Confirm", statuses: ["received", "awaiting_availability", "awaiting_customer"] },
  { key: "pay", label: "Pay", statuses: ["pending_payment"] },
  { key: "cook", label: "Cook", statuses: ["queued", "preparing"] },
  { key: "ready", label: "Ready", statuses: ["ready", "out_for_delivery"] },
  { key: "done", label: "Done", statuses: ["delivered", "picked_up", "completed"] },
];

async function Order({ params }: { params: PageProps<"/o/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const loaded = await loadWebOrderByToken(token);
  if (!loaded) notFound();
  const { row, order, availability } = loaded;
  const store = await getStoreById(row.store_id);
  const status = row.status as OrderStatus;
  const text = STATUS_TEXT[status];
  const terminal = TERMINAL_ORDER_STATUSES.includes(status);
  const stepIndex = STEPS.findIndex((s) => s.statuses.includes(status));
  const slot = new Date(order.scheduledFor);
  const sameDay = manilaParts(slot).dateKey === manilaParts(new Date()).dateKey;
  const results = new Map((availability?.items ?? []).map((i) => [i.lineId, i]));
  const sad = ["denied", "rejected", "cancelled", "expired"].includes(status);

  const needsDecision = status === "awaiting_customer" && availability;
  const revised = needsDecision ? await revisedOrder(order, availability) : null;
  const needsPayment = status === "pending_payment" && ["awaiting_payment", "rejected", "partial"].includes(row.payment_status);
  const settings = needsPayment ? (await fetchCatalog(row.store_id)).settings : null;
  const cancellable = ["received", "awaiting_availability", "awaiting_customer", "pending_payment"].includes(status) && !["submitted", "confirmed"].includes(row.payment_status);

  return (
    <>
      <LiveOrder token={token} active={!terminal} status={status} paymentStatus={row.payment_status} />
      {store && (
        <Link href={storePath(store.slug)} className="text-sm text-stone-500 hover:text-orange-700">
          ← {store.name}
        </Link>
      )}
      <div className="mb-6 mt-3">
        <p className="text-sm text-stone-500">
          {store ? `${store.name} · ` : ""}Order {row.order_code}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{text.title}</h1>
        <p className="mt-1 text-stone-600 dark:text-stone-400">
          {status === "awaiting_availability" && order.confirmWaitMinutes ? `Usually within ~${order.confirmWaitMinutes} minutes. ` : ""}
          {text.body}
        </p>
        {row.rider_name && ["out_for_delivery", "delivered"].includes(status) && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">
            <span aria-hidden="true">🛵</span>
            <span>
              Your rider: <strong>{row.rider_name}</strong>
              {status === "out_for_delivery" ? " is on the way." : ""}
            </span>
          </p>
        )}
        {row.status_note && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{row.status_note}</p>}
        {store?.contact && (
          <p className="mt-2 text-sm text-stone-500">
            Questions about this order? Contact {store.name}: <ContactLink contact={store.contact} />
          </p>
        )}
      </div>

      {!sad && stepIndex >= 0 && (
        <ol className="mb-6 grid grid-cols-5 gap-1 text-center text-xs">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-col items-center gap-1">
              <span className={`h-1.5 w-full rounded-full ${i <= stepIndex ? "bg-orange-600" : "bg-stone-200 dark:bg-stone-800"}`} />
              <span className={i === stepIndex ? "font-semibold" : "text-stone-500"}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}

      {!terminal && (
        <div className="mb-6">
          <NotifyButton token={token} />
        </div>
      )}

      {needsDecision && revised && (
        <section className="mb-5 rounded-xl border-2 border-orange-500 bg-white p-4 dark:bg-stone-900">
          <h2 className="mb-2 font-semibold">We checked your order</h2>
          <ul className="mb-3 flex flex-col gap-1 text-sm">
            {order.items.map((i) => {
              const r = results.get(i.lineId);
              if (!r) return null;
              return (
                <li key={i.lineId}>
                  {r.status === "cant_source" ? (
                    <span className="text-red-700 dark:text-red-400">✗ {i.name}: not available today{r.note ? ` (${r.note})` : ""}</span>
                  ) : (
                    <span className="text-green-700 dark:text-green-400">
                      ✓ {i.name}: available
                      {i.priceMode === "market" && r.finalUnitPrice !== null ? `, final price ${peso(r.finalUnitPrice)}` : ""}
                      {r.note ? ` (${r.note})` : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {revised.items.length > 0 ? (
            <p className="mb-3 text-sm">
              New total: <strong>{peso(revised.totals.total)}</strong>
            </p>
          ) : (
            <p className="mb-3 text-sm">Nothing in your order is available today.</p>
          )}
          <div className="flex flex-wrap gap-3">
            {revised.items.length > 0 && (
              <ActionForm action={decide} submitLabel="Continue with the available items">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="decision" value="continue" />
              </ActionForm>
            )}
            <ActionForm action={decide} submitLabel="Cancel order" danger>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="decision" value="cancel" />
            </ActionForm>
          </div>
        </section>
      )}

      {needsPayment && settings && (
        <section className="mb-5 rounded-xl border-2 border-orange-500 bg-white p-4 dark:bg-stone-900">
          <h2 className="mb-1 font-semibold">Pay {peso(row.total)} with GCash</h2>
          {row.payment_status === "rejected" && (
            <p className="mb-2 text-sm text-red-700 dark:text-red-400">We couldn&apos;t confirm your last payment. Please check and send it again.</p>
          )}
          <div className="my-3 flex flex-col items-center gap-2">
            {settings.gcashQrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.gcashQrUrl} alt="GCash QR code" className="w-56 rounded-lg border border-stone-200" />
            ) : (
              <p className="text-sm text-stone-500">The GCash QR will appear here. Please message us for payment details.</p>
            )}
            {settings.gcashAccountName && <p className="text-sm">Account name: {settings.gcashAccountName}</p>}
          </div>
          <ol className="mb-3 list-decimal pl-5 text-sm text-stone-600 dark:text-stone-400">
            <li>Scan the QR in GCash and pay exactly {peso(row.total)}.</li>
            <li>Copy the reference number from the GCash receipt.</li>
            <li>Send it below. A screenshot helps us confirm faster.</li>
          </ol>
          <ActionForm action={submitPayment} submitLabel="Send payment details">
            <input type="hidden" name="token" value={token} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">GCash reference number</span>
              <input name="referenceNo" inputMode="numeric" required className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-950" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Name on your GCash account</span>
              <input name="senderName" required defaultValue={order.customer.name} className="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-950" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Screenshot (optional)</span>
              <input name="proof" type="file" accept="image/*" className="text-sm" />
            </label>
          </ActionForm>
        </section>
      )}

      {status === "pending_payment" && row.payment_status === "submitted" && (
        <p className="mb-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-200">
          Payment details received. We&apos;re checking it in GCash now.
        </p>
      )}

      <section className="mb-5 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{order.fulfillment === "pickup" ? "Pickup" : "Delivery"}</h2>
          <Badge tone="orange">
            {sameDay ? "Today" : slot.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" })},{" "}
            {formatManilaTime(slot)}
          </Badge>
        </div>
        {order.address && (
          <p className="mb-3 text-sm text-stone-600 dark:text-stone-400">
            {[order.address.streetPurok, order.address.barangay, order.address.landmark && `near ${order.address.landmark}`].filter(Boolean).join(", ")}
          </p>
        )}
        <ul className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
          {order.items.map((i) => {
            const r = results.get(i.lineId);
            const price = i.unitPrice ?? i.estimatedUnitPrice ?? 0;
            return (
              <li key={i.lineId} className={`flex justify-between gap-3 py-2 ${r?.status === "cant_source" ? "text-stone-400 line-through" : ""}`}>
                <div>
                  <p>
                    {i.qty}× {i.name}
                    {i.weightKg ? ` (${i.weightKg} kg)` : ""}
                  </p>
                  {i.modifiers.length > 0 && <p className="text-xs text-stone-500">{i.modifiers.map((m) => m.option).join(" · ")}</p>}
                  {i.notes && <p className="text-xs text-stone-500">“{i.notes}”</p>}
                </div>
                <span>
                  {i.unitPrice === null ? "~" : ""}
                  {peso(price * i.qty)}
                </span>
              </li>
            );
          })}
        </ul>
        <dl className="mt-3 flex flex-col gap-1 border-t border-stone-200 pt-3 text-sm dark:border-stone-700">
          <div className="flex justify-between">
            <dt className="text-stone-500">Subtotal</dt>
            <dd>{peso(row.subtotal)}</dd>
          </div>
          {row.discount_amount > 0 && (
            <div className="flex justify-between">
              <dt className="text-stone-500">Discount</dt>
              <dd>−{peso(row.discount_amount)}</dd>
            </div>
          )}
          {order.fulfillment === "delivery" && (
            <div className="flex justify-between">
              <dt className="text-stone-500">Delivery fee</dt>
              <dd>{peso(row.delivery_fee)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>
              {row.is_estimate ? "~" : ""}
              {peso(row.total)}
            </dd>
          </div>
        </dl>
        {row.is_estimate && <p className="mt-2 text-xs text-stone-500">~ Estimated: we confirm market prices before you pay.</p>}
      </section>

      {cancellable && (
        <ActionForm action={cancelOrder} submitLabel="Cancel this order" danger className="flex flex-col items-start gap-2">
          <input type="hidden" name="token" value={token} />
        </ActionForm>
      )}

      <p className="mt-6 text-xs text-stone-500">Keep this page&apos;s link to check your order. Anyone with the link can see it.</p>
    </>
  );
}
