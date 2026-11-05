import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatManilaTime, manilaParts, type ModifierSelection } from "@wfh/shared";
import { peso } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { getStoreById } from "@/lib/stores";
import { PrintNow } from "./print-now";

export const metadata = { title: "Print", robots: { index: false } };

// Print views live outside the admin layout so only the ticket/labels print.
export default function PrintPage({ params, searchParams }: PageProps<"/admin/print/[id]">) {
  return (
    <Suspense fallback={null}>
      <Print params={params} searchParams={searchParams} />
    </Suspense>
  );
}

type Item = {
  id: string;
  name: string;
  qty: number;
  weight_kg: number | null;
  modifiers: unknown;
  notes: string;
  item_status: string;
  requires_cooking: boolean;
  sort_order: number;
  order_item_availability: { status: string } | null;
};

function when(iso: string) {
  const slot = new Date(iso);
  const today = manilaParts(slot).dateKey === manilaParts(new Date()).dateKey;
  const day = today ? "Today" : slot.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" });
  return `${day} ${formatManilaTime(slot)}`;
}

const options = (i: Item) => (i.modifiers as ModifierSelection[]).map((m) => m.option);

async function Print({ params, searchParams }: { params: PageProps<"/admin/print/[id]">["params"]; searchParams: PageProps<"/admin/print/[id]">["searchParams"] }) {
  const { supabase, storeId } = await requireStaff();
  const { id } = await params;
  const query = await searchParams;
  const kind = query.type === "labels" ? "labels" : "ticket";
  const auto = query.autoprint === "1";

  const [{ data: order }, { data: settings }, store] = await Promise.all([
    supabase
      .schema("ops")
      .from("orders")
      .select(
        `id, queue_code, external_id, source, fulfillment, scheduled_for, customer_name, customer_phone, address, barangay,
         delivery_fee, discount_amount, total, payment_method, payment_status, flags, notes, rider_name, parent_order_id,
         order_items(id, name, qty, weight_kg, modifiers, notes, item_status, requires_cooking, sort_order, order_item_availability(status))`,
      )
      .eq("id", id)
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .schema("store")
      .from("store_settings")
      .select("print_ticket_width_mm, print_label_width_mm, print_label_height_mm, print_labels_per_unit")
      .eq("store_id", storeId)
      .single(),
    getStoreById(storeId),
  ]);
  if (!order || !settings) notFound();

  // Add-on orders print "ADD-ON to A-006" so they go in the same bag as the original.
  const parentCode = order.parent_order_id
    ? ((await supabase.schema("ops").from("orders").select("queue_code").eq("id", order.parent_order_id).maybeSingle()).data?.queue_code ?? null)
    : null;

  const items = (order.order_items as Item[])
    .filter((i) => i.item_status !== "removed" && i.order_item_availability?.status !== "cant_source")
    .sort((a, b) => a.sort_order - b.sort_order);
  const address = order.address as { streetPurok?: string; landmark?: string; riderNotes?: string } | null;
  const delivery = order.fulfillment === "delivery";
  const paid = order.payment_status === "confirmed";
  const payment = paid
    ? `PAID${order.payment_method ? ` (${order.payment_method === "gcash" ? "GCash" : "cash"})` : ""}`
    : order.flags.includes("collect_payment")
      ? `COLLECT ${peso(order.total)}`
      : "NOT PAID";

  const pageCss =
    kind === "ticket"
      ? `@page { size: ${settings.print_ticket_width_mm}mm auto; margin: 0; }`
      : `@page { size: ${settings.print_label_width_mm}mm ${settings.print_label_height_mm}mm; margin: 0; }`;

  return (
    <div className="print-root min-h-full bg-white p-4 text-black print:p-0">
      <style>{`
        ${pageCss}
        @media print {
          html, body { background: #fff !important; color: #000 !important; }
          body > *:not(.print-root) { display: none !important; }
        }
        .ticket { width: ${settings.print_ticket_width_mm - 6}mm; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: ${settings.print_ticket_width_mm === 58 ? 10 : 12}pt; line-height: 1.3; }
        .ticket hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
        .label { width: ${settings.print_label_width_mm}mm; height: ${settings.print_label_height_mm}mm; padding: 1.5mm 2mm; box-sizing: border-box; overflow: hidden;
                 font-family: Arial, Helvetica, sans-serif; font-size: 8pt; line-height: 1.2; break-after: page; page-break-after: always; }
        @media screen { .label { border: 1px dashed #999; margin-bottom: 4mm; } }
      `}</style>
      <div>
        <PrintNow auto={auto} />

        {kind === "ticket" ? (
          <div className="ticket mx-auto print:mx-0 print:px-[3mm] print:py-[2mm]">
            <div style={{ textAlign: "center" }}>
              {store && <div>{store.name.toUpperCase()}</div>}
              <div style={{ fontSize: "28pt", fontWeight: 700, lineHeight: 1.1 }}>{order.queue_code}</div>
              <div style={{ fontWeight: 700 }}>
                {delivery ? "DELIVERY" : "PICKUP"} · {when(order.scheduled_for)}
              </div>
              <div>{order.external_id ?? (order.source === "walk_in" ? "Walk-in" : order.source === "phone" ? "Phone order" : "Messenger order")}</div>
            </div>
            <hr />
            <div>
              <strong>{order.customer_name ?? "—"}</strong>
              {order.customer_phone ? ` · ${order.customer_phone}` : ""}
            </div>
            {delivery && (
              <div>
                {[address?.streetPurok, order.barangay].filter(Boolean).join(", ")}
                {address?.landmark && <div>Near {address.landmark}</div>}
                {address?.riderNotes && <div>Rider: {address.riderNotes}</div>}
              </div>
            )}
            <hr />
            {items.map((i) => (
              <div key={i.id} style={{ marginBottom: "1.5mm" }}>
                <div style={{ fontWeight: 700, fontSize: "1.15em" }}>
                  {i.qty}× {i.name}
                  {i.weight_kg ? ` (${i.weight_kg} kg)` : ""}
                  {!i.requires_cooking ? " [no cooking]" : ""}
                </div>
                {options(i).length > 0 && <div style={{ paddingLeft: "3mm" }}>{options(i).join(", ")}</div>}
                {i.notes && <div style={{ paddingLeft: "3mm", fontWeight: 700, whiteSpace: "pre-line" }}>** {i.notes} **</div>}
              </div>
            ))}
            {order.notes && (
              <>
                <hr />
                <div style={{ whiteSpace: "pre-line" }}>Note: {order.notes}</div>
              </>
            )}
            <hr />
            {delivery && <div>Delivery fee {peso(order.delivery_fee)}</div>}
            {order.discount_amount > 0 && <div>Discount −{peso(order.discount_amount)}</div>}
            <div style={{ fontWeight: 700, fontSize: "1.15em" }}>Total {peso(order.total)}</div>
            <div style={{ fontWeight: 700 }}>{payment}</div>
            {order.rider_name && <div>Rider: {order.rider_name}</div>}
            <hr />
            <div style={{ textAlign: "center", fontSize: "0.85em" }}>Printed {formatManilaTime(new Date())}</div>
          </div>
        ) : (
          <div>
            {items.flatMap((i) => {
              const count = settings.print_labels_per_unit ? i.qty : 1;
              return Array.from({ length: count }, (_, n) => (
                <div key={`${i.id}-${n}`} className="label">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontWeight: 700 }}>
                    <span style={{ fontSize: "12pt" }}>{order.queue_code}</span>
                    <span>
                      {delivery ? "DELIVERY" : "PICKUP"} · {paid ? "PAID" : order.flags.includes("collect_payment") ? `COLLECT ${peso(order.total)}` : "NOT PAID"}
                    </span>
                  </div>
                  {parentCode && <div style={{ fontWeight: 700, fontSize: "8pt" }}>ADD-ON to {parentCode}</div>}
                  <div style={{ fontWeight: 700, fontSize: "9pt", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{order.customer_name ?? ""}</div>
                  <div style={{ fontWeight: 700, fontSize: "10pt" }}>
                    {settings.print_labels_per_unit ? "" : `${i.qty}× `}
                    {i.name}
                    {i.weight_kg ? ` ${i.weight_kg} kg` : ""}
                  </div>
                  {options(i).length > 0 && <div>{options(i).join(", ")}</div>}
                  {i.notes && <div style={{ whiteSpace: "pre-line" }}>“{i.notes}”</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7pt" }}>
                    <span>{when(order.scheduled_for)}</span>
                    {settings.print_labels_per_unit && i.qty > 1 && (
                      <span>
                        {n + 1} of {i.qty}
                      </span>
                    )}
                  </div>
                </div>
              ));
            })}
          </div>
        )}
      </div>
    </div>
  );
}
