"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { DeliveryQuote } from "@wfh/shared";
import { OptionsSheet } from "@/app/add-to-cart";
import { MapPicker } from "@/components/map-picker";
import { Badge, peso } from "@/components/ui";
import type { CartEntry } from "@/lib/cart-store";
import type { MenuItem } from "@/lib/menu";
import { toast } from "@/lib/toast";
import { createManualOrder } from "./actions";

type LatLng = { lat: number; lng: number };
type Line = CartEntry & { finalUnitPrice: string };
type Payment = "cash_now" | "gcash_now" | "pay_on_handover" | "gcash_later";

/** The order the new items are added to (add-on mode). */
export interface AddOnTarget {
  id: string;
  queueCode: string;
  customerName: string | null;
  fulfillment: "pickup" | "delivery";
  when: string;
  barangay: string | null;
}

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950";
const section =
  "mb-5 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900";

const PAYMENTS: { value: Payment; label: string }[] = [
  { value: "cash_now", label: "Cash, paid now" },
  { value: "gcash_now", label: "GCash, paid now" },
  { value: "pay_on_handover", label: "Pay on pickup/delivery (cash)" },
  { value: "gcash_later", label: "GCash later (goes to Payment Review)" },
];

export function ManualOrderForm({
  categories,
  barangays,
  kitchen,
  mapCenter,
  defaultPrepMinutes,
  addTo,
}: {
  categories: { id: string; name: string; items: MenuItem[] }[];
  barangays: { id: string; name: string; center: LatLng | null }[];
  kitchen: LatLng | null;
  mapCenter: LatLng;
  defaultPrepMinutes: number;
  addTo: AddOnTarget | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);

  const [adding, setAdding] = useState<MenuItem | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [source, setSource] = useState<"walk_in" | "phone" | "messenger">(
    addTo ? "phone" : "walk_in",
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [barangayId, setBarangayId] = useState("");
  const [streetPurok, setStreetPurok] = useState("");
  const [landmark, setLandmark] = useState("");
  const [riderNotes, setRiderNotes] = useState("");
  const [pin, setPin] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<LatLng>(mapCenter);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [feeEdited, setFeeEdited] = useState(false);
  const [feeReason, setFeeReason] = useState("");
  const [quote, setQuote] = useState<{
    key: string;
    result: { ok: true; quote: DeliveryQuote } | { ok: false; error: string };
  } | null>(null);
  const [when, setWhen] = useState<"asap" | "later">("asap");
  const [later, setLater] = useState("");
  const [payment, setPayment] = useState<Payment>("cash_now");
  const [amountReceived, setAmountReceived] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");

  const unitPrice = (l: Line) =>
    l.isEstimate ? Number(l.finalUnitPrice || 0) : l.displayUnitPrice;
  const subtotal = Math.round(lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0) * 100) / 100;
  const fee = fulfillment === "delivery" ? Number(deliveryFee || 0) : 0;
  const total = subtotal + fee;
  const change = payment === "cash_now" && amountReceived ? Number(amountReceived) - total : null;
  const prep =
    Math.max(0, ...lines.map((l) => l.prepMinutes)) ||
    (lines.some((l) => l.requiresCooking) ? defaultPrepMinutes : 0);

  // Calculated delivery fee for the pin, used as the default fee until staff type their own.
  const quoteKey =
    fulfillment === "delivery" && pin && barangayId ? `${pin.lat},${pin.lng},${barangayId}` : null;
  const currentQuote = quote && quote.key === quoteKey ? quote.result : null;
  useEffect(() => {
    if (!quoteKey || !pin) return;
    const controller = new AbortController();
    fetch("/api/delivery/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: pin.lat, lng: pin.lng, barangayId, subtotal: 0 }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((result: { ok: true; quote: DeliveryQuote } | { ok: false; error: string }) => {
        setQuote({ key: quoteKey, result });
        if (result.ok && !feeEdited) setDeliveryFee(String(result.quote.fee));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [quoteKey, pin, barangayId, feeEdited]);
  const feeDiffers =
    fulfillment === "delivery" && (!currentQuote?.ok || currentQuote.quote.fee !== fee);

  function updateLine(lineId: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)));
  }

  function submit() {
    const problems: string[] = [];
    if (lines.length === 0) problems.push("Add at least one item");
    if (!addTo && fulfillment === "delivery" && !barangayId) problems.push("Choose the barangay");
    if (!addTo && fulfillment === "delivery" && deliveryFee === "")
      problems.push("Enter the delivery fee");
    if (!addTo && when === "later" && !later) problems.push("Choose the pickup/delivery time");
    if (payment === "cash_now" && (change === null || change < 0))
      problems.push("Enter the cash received (at least the total)");
    setErrors(problems);
    if (problems.length) return;

    const scheduledFor =
      when === "asap" ? new Date(Date.now() + prep * 60_000).toISOString() : `${later}:00+08:00`;
    startTransition(async () => {
      const result = await createManualOrder({
        source,
        customerName: name,
        phone,
        fulfillment,
        scheduledFor,
        address:
          fulfillment === "delivery"
            ? {
                barangayId,
                streetPurok,
                landmark,
                riderNotes,
                lat: pin?.lat ?? null,
                lng: pin?.lng ?? null,
              }
            : null,
        deliveryFee: fee,
        feeReason,
        payment,
        amountReceived: amountReceived ? Number(amountReceived) : null,
        referenceNo,
        notes,
        parentOrderId: addTo?.id ?? null,
        lines: lines.map((l) => ({
          lineId: l.lineId,
          productId: l.productId,
          qty: l.qty,
          weightKg: l.weightKg,
          modifierIds: l.modifierIds,
          notes: l.notes,
          finalUnitPrice: l.isEstimate ? Number(l.finalUnitPrice || 0) : null,
        })),
      });
      if (!result.ok) return setErrors(result.errors);
      toast({
        title: `Order ${result.queueCode} created`,
        body: result.change !== null ? `Change: ${peso(result.change)}` : undefined,
        tone: "success",
      });
      router.push("/admin/orders");
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      {/* Menu */}
      <section className={section}>
        <h2 className="mb-3 font-semibold">Menu</h2>
        {categories.map((c) => (
          <div key={c.id} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              {c.name}
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {c.items.map((item) => {
                const disabled = item.badge === "sold_out" || item.badge === "unavailable";
                const price =
                  item.priceMode === "market" ? (item.price ?? item.estimatedPrice) : item.price;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setAdding(item)}
                    className="flex flex-col items-start rounded-lg border border-stone-200 p-3 text-left text-sm hover:border-orange-500 disabled:opacity-40 dark:border-stone-700"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-stone-500">
                      {disabled
                        ? item.badge === "sold_out"
                          ? "Sold out"
                          : "No price yet"
                        : `${item.priceMode === "market" ? "~" : ""}${peso(price)}${item.soldBy === "weight" ? "/kg" : ""}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Order */}
      <div>
        <section className={section}>
          <h2 className="mb-3 font-semibold">Order</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-stone-500">Tap items on the menu to add them.</p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {lines.map((l) => (
                <li key={l.lineId} className="py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{l.name}</p>
                      {l.optionLabels.length > 0 && (
                        <p className="text-xs text-stone-500">{l.optionLabels.join(" · ")}</p>
                      )}
                    </div>
                    <span>{peso(unitPrice(l) * l.qty)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-lg border border-stone-300 dark:border-stone-700">
                      <button
                        type="button"
                        className="px-2"
                        onClick={() => updateLine(l.lineId, { qty: Math.max(1, l.qty - 1) })}
                        aria-label="Less"
                      >
                        −
                      </button>
                      <span className="w-6 text-center">{l.qty}</span>
                      <button
                        type="button"
                        className="px-2"
                        onClick={() => updateLine(l.lineId, { qty: Math.min(50, l.qty + 1) })}
                        aria-label="More"
                      >
                        +
                      </button>
                    </div>
                    {l.isEstimate && (
                      <label className="flex items-center gap-1 text-xs">
                        Final price ₱
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.finalUnitPrice}
                          onChange={(e) => updateLine(l.lineId, { finalUnitPrice: e.target.value })}
                          className="w-24 rounded border border-stone-300 px-2 py-1 dark:border-stone-700 dark:bg-stone-950"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => setLines((ls) => ls.filter((x) => x.lineId !== l.lineId))}
                      className="ml-auto text-xs text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {addTo ? (
          <section className="mb-5 rounded-xl border-2 border-orange-500 bg-orange-50 p-4 text-sm dark:bg-orange-950">
            <h2 className="font-semibold">Adding to {addTo.queueCode}</h2>
            <p className="mt-1">
              {addTo.customerName ?? "Customer"} ·{" "}
              {addTo.fulfillment === "delivery"
                ? `Delivery${addTo.barangay ? ` to ${addTo.barangay}` : ""}`
                : "Pickup"}{" "}
              · {addTo.when}
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
              Labels print as “ADD-ON to {addTo.queueCode}” so they go in the same bag. No extra
              delivery fee.
            </p>
          </section>
        ) : (
          <>
            <section className={section}>
              <h2 className="mb-3 font-semibold">Customer</h2>
              <div className="mb-3 grid grid-cols-3 gap-2">
                {(["walk_in", "phone", "messenger"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={`rounded-lg border px-2 py-1.5 text-sm ${source === s ? "border-orange-600 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "border-stone-300 dark:border-stone-700"}`}
                  >
                    {s === "walk_in" ? "Walk-in" : s === "phone" ? "Phone" : "Messenger"}
                  </button>
                ))}
              </div>
              <div className="grid gap-3">
                <input
                  className={inputClass}
                  placeholder={source === "walk_in" ? "Name (optional)" : "Name"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className={inputClass}
                  placeholder={
                    source === "walk_in" && fulfillment === "pickup"
                      ? "Mobile (optional)"
                      : "Mobile number"
                  }
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </section>

            <section className={section}>
              <h2 className="mb-3 font-semibold">Pickup or delivery</h2>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(["pickup", "delivery"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFulfillment(f)}
                    className={`rounded-lg border px-2 py-1.5 text-sm ${fulfillment === f ? "border-orange-600 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "border-stone-300 dark:border-stone-700"}`}
                  >
                    {f === "pickup" ? "Pickup" : "Delivery"}
                  </button>
                ))}
              </div>
              {fulfillment === "delivery" && (
                <div className="grid gap-3">
                  <select
                    className={inputClass}
                    value={barangayId}
                    onChange={(e) => {
                      setBarangayId(e.target.value);
                      const c = barangays.find((b) => b.id === e.target.value)?.center;
                      if (c) setFocus(c);
                    }}
                  >
                    <option value="">Barangay…</option>
                    {barangays.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className={inputClass}
                    placeholder="Purok / street"
                    value={streetPurok}
                    onChange={(e) => setStreetPurok(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Landmark"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                  />
                  <input
                    className={inputClass}
                    placeholder="Notes for the rider"
                    value={riderNotes}
                    onChange={(e) => setRiderNotes(e.target.value)}
                  />
                  <p className="text-xs text-stone-500">
                    Optional: tap the map to calculate the fee.
                  </p>
                  <MapPicker
                    value={pin}
                    focus={focus}
                    onChange={setPin}
                    kitchen={kitchen}
                    className="h-48 w-full overflow-hidden rounded-xl border border-stone-300 dark:border-stone-700"
                  />
                  {currentQuote && (
                    <p className="text-xs">
                      {currentQuote.ok ? (
                        `Calculated: ${peso(currentQuote.quote.fee)} · ${currentQuote.quote.distanceKm} km`
                      ) : (
                        <span className="text-red-700">{currentQuote.error}</span>
                      )}
                    </p>
                  )}
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">Delivery fee (₱)</span>
                    <input
                      className={inputClass}
                      type="number"
                      min="0"
                      step="5"
                      value={deliveryFee}
                      onChange={(e) => {
                        setDeliveryFee(e.target.value);
                        setFeeEdited(true);
                      }}
                    />
                  </label>
                  {feeDiffers && deliveryFee !== "" && (
                    <input
                      className={inputClass}
                      placeholder="Reason for this fee (required)"
                      value={feeReason}
                      onChange={(e) => setFeeReason(e.target.value)}
                    />
                  )}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWhen("asap")}
                  className={`rounded-lg border px-2 py-1.5 text-sm ${when === "asap" ? "border-orange-600 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "border-stone-300 dark:border-stone-700"}`}
                >
                  As soon as ready{prep ? ` (~${prep} min)` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWhen("later");
                    if (!later) {
                      const inAnHour = new Date(Date.now() + 60 * 60_000 + 8 * 3600_000)
                        .toISOString()
                        .slice(0, 16);
                      setLater(inAnHour);
                    }
                  }}
                  className={`rounded-lg border px-2 py-1.5 text-sm ${when === "later" ? "border-orange-600 bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200" : "border-stone-300 dark:border-stone-700"}`}
                >
                  Later
                </button>
              </div>
              {when === "later" && (
                <input
                  type="datetime-local"
                  className={`${inputClass} mt-2`}
                  value={later}
                  onChange={(e) => setLater(e.target.value)}
                  aria-label="Pickup or delivery time (Manila)"
                />
              )}
            </section>
          </>
        )}

        <section className={section}>
          <h2 className="mb-3 font-semibold">Payment</h2>
          <select
            className={inputClass}
            value={payment}
            onChange={(e) => setPayment(e.target.value as Payment)}
          >
            {PAYMENTS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {payment === "cash_now" && (
            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="font-medium">Cash received (₱)</span>
              <input
                className={inputClass}
                type="number"
                min="0"
                step="1"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
            </label>
          )}
          {payment === "gcash_now" && (
            <input
              className={`${inputClass} mt-3`}
              placeholder="GCash reference no. (optional)"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          )}
          <textarea
            className={`${inputClass} mt-3`}
            rows={2}
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <dl className="mt-4 flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Subtotal</dt>
              <dd>{peso(subtotal)}</dd>
            </div>
            {fulfillment === "delivery" && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Delivery</dt>
                <dd>{peso(fee)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd>{peso(total)}</dd>
            </div>
            {change !== null && (
              <div className="flex justify-between">
                <dt className="text-stone-500">Change</dt>
                <dd>
                  {change >= 0 ? (
                    <Badge tone="green">{peso(change)}</Badge>
                  ) : (
                    <span className="text-red-700">Not enough</span>
                  )}
                </dd>
              </div>
            )}
          </dl>

          {errors.length > 0 && (
            <ul
              className="mt-3 list-disc rounded-lg bg-red-50 p-3 pl-6 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
              role="alert"
            >
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="mt-4 w-full rounded-xl bg-orange-600 px-4 py-3 font-medium text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : `Create order · ${peso(total)}`}
          </button>
        </section>
      </div>

      {adding && (
        <OptionsSheet
          item={adding}
          onClose={() => setAdding(null)}
          onAdd={(entry) =>
            setLines((ls) => [
              ...ls,
              { ...entry, finalUnitPrice: entry.isEstimate ? String(entry.displayUnitPrice) : "" },
            ])
          }
        />
      )}
    </div>
  );
}
