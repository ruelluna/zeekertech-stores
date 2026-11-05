"use client";

import Link from "next/link";
import { FacebookPrompt } from "@/components/facebook-prompt";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import {
  calculateDiscount,
  dailyLimitShortfalls,
  formatManilaTime,
  listSlots,
  manilaParts,
  requiredLeadMinutes,
  shortfallMessage,
  type BookedQty,
  type ClockTime,
  type DeliveryQuote,
  type StoreHoursDay,
} from "@wfh/shared";
import { MapPicker } from "@/components/map-picker";
import { Badge, peso } from "@/components/ui";
import { cartFor, cartSubtotal, useCart, type Cart, type CartEntry } from "@/lib/cart-store";
import { rememberOrder } from "@/lib/recent-orders";
import type { WelcomeOffer } from "@/lib/discounts";
import type { MenuItem } from "@/lib/menu";
import { OptionsSheet } from "@/app/add-to-cart";
import { placeOrder } from "./actions";

type LatLng = { lat: number; lng: number };

export interface CheckoutData {
  store: { id: string; slug: string; name: string; facebookUrl: string | null };
  customer: { name: string; phone: string | null } | null;
  facebookLogin: boolean;
  offer: WelcomeOffer | null;
  /** Current menu items by product id, for each line's price breakdown and editing its options. */
  menuItems: Record<string, MenuItem>;
  /** Booked quantity per SKU per Manila date, for products with a daily limit. */
  booked: BookedQty;
  savedAddresses: { id: string; label: string; barangayId: string; streetPurok: string; landmark: string; riderNotes: string; lat: number; lng: number }[];
  barangays: { id: string; name: string; center: LatLng | null }[];
  kitchen: LatLng | null;
  mapCenter: LatLng;
  /** Off = the store is pickup-only. */
  deliveryEnabled: boolean;
  /** The kitchen pin is set, so delivery can be quoted. */
  deliveryReady: boolean;
  hours: StoreHoursDay[];
  closures: string[];
  settings: {
    orderingPaused: boolean;
    allowPreorders: boolean;
    prepLeadMinutes: number;
    deliveryBufferMinutes: number;
    uncertainItemsCutoff: ClockTime;
    slotStartOffsetMinutes: number;
    slotEndOffsetMinutes: number;
    pickupInstructions: string | null;
    kitchenAddress: string | null;
  };
}

type QuoteState = { status: "idle" } | { status: "loading" } | { status: "ok"; quote: DeliveryQuote; estimated: boolean } | { status: "error"; error: string };

// The current minute, from the browser clock (null during server rendering).
const subscribeMinute = (onChange: () => void) => {
  const t = setInterval(onChange, 15_000);
  return () => clearInterval(t);
};
const currentMinute = () => Math.floor(Date.now() / 60_000);

const inputClass = "w-full rounded-lg border border-ink-500 bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-ink-400 dark:bg-ink-950";

export function CheckoutForm({ data }: { data: CheckoutData }) {
  const router = useRouter();
  const lines = useCart(data.store.slug);
  const cart = cartFor(data.store.slug);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [editing, setEditing] = useState<CartEntry | null>(null);

  const minute = useSyncExternalStore(subscribeMinute, currentMinute, () => null);
  const now = useMemo(() => (minute === null ? null : new Date(minute * 60_000)), [minute]);

  const [name, setName] = useState(data.customer?.name ?? "");
  const [phone, setPhone] = useState(data.customer?.phone ?? "");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");

  const firstSaved = data.savedAddresses[0];
  const [savedId, setSavedId] = useState<string | "new">(firstSaved?.id ?? "new");
  const [barangayId, setBarangayId] = useState(firstSaved?.barangayId ?? "");
  const [streetPurok, setStreetPurok] = useState(firstSaved?.streetPurok ?? "");
  const [landmark, setLandmark] = useState(firstSaved?.landmark ?? "");
  const [riderNotes, setRiderNotes] = useState(firstSaved?.riderNotes ?? "");
  const [pin, setPin] = useState<LatLng | null>(firstSaved ? { lat: firstSaved.lat, lng: firstSaved.lng } : null);
  const [focus, setFocus] = useState<LatLng>(pin ?? data.mapCenter);
  const [saveAddress, setSaveAddress] = useState<boolean>(Boolean(data.customer) && !firstSaved);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [quoteResult, setQuoteResult] = useState<{ key: string; value: QuoteState } | null>(null);

  const [dateKey, setDateKey] = useState<string>("");
  const [slotIso, setSlotIso] = useState<string>("");
  const [consent, setConsent] = useState(false);

  const subtotal = cartSubtotal(lines);
  // A quote belongs to one pin/barangay/subtotal; anything else shows as loading until it arrives.
  const quoteKey = fulfillment === "delivery" && pin && barangayId ? `${pin.lat},${pin.lng},${barangayId},${subtotal}` : null;
  const quote: QuoteState = !quoteKey ? { status: "idle" } : quoteResult?.key === quoteKey ? quoteResult.value : { status: "loading" };
  const isEstimate = lines.some((l) => l.isEstimate);
  const hasUncertain = lines.some((l) => l.needsAvailability);
  // Made-to-order items (cakes etc.) push the whole order to their earliest date.
  const noticeDays = Math.max(0, ...lines.map((l) => l.noticeDays ?? 0));
  const noticeItems = lines.filter((l) => (l.noticeDays ?? 0) > 0);
  const prep = Math.max(0, ...lines.map((l) => l.prepMinutes)) || (lines.some((l) => l.requiresCooking) ? data.settings.prepLeadMinutes : 0);
  const deliveryFee = fulfillment === "delivery" && quote.status === "ok" ? quote.quote.fee : 0;
  const discount = data.offer ? calculateDiscount(data.offer, subtotal) : 0;
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  const lead = requiredLeadMinutes({
    fulfillment,
    prepMinutes: prep,
    travelMinutes: fulfillment === "delivery" && quote.status === "ok" ? quote.quote.travelMinutes : null,
    bufferMinutes: data.settings.deliveryBufferMinutes,
  });

  // Dates with at least one bookable slot (today only when pre-orders are off, unless items need notice),
  // leaving out days where a product in the cart is over its daily limit. When days are full, the search
  // goes up to 3 weeks further, until it offers as many days as it would have (a booked-out weekend still
  // offers the next one).
  const { days, fullDays, overLimit } = useMemo(() => {
    const result: { dateKey: string; label: string; slots: Date[] }[] = [];
    const full: { label: string; reason: string }[] = [];
    const limited = lines.flatMap((l) => {
      const item = data.menuItems[l.productId];
      return item?.dailyLimit ? [{ sku: item.sku, name: l.name, qty: l.qty, dailyLimit: item.dailyLimit }] : [];
    });
    // More than a whole day's limit never fits on any day: say so instead of listing full days.
    const over = dailyLimitShortfalls(limited, {}, "any");
    if (!now || over.length) return { days: result, fullDays: full, overLimit: over };
    const dayCount = noticeDays > 0 ? noticeDays + 7 : data.settings.allowPreorders ? 7 : 1;
    let openDaysInWindow = 0;
    for (let i = 0; i < dayCount + 21; i++) {
      if (i >= dayCount && result.length >= openDaysInWindow) break;
      const key = manilaParts(new Date(now.getTime() + i * 86_400_000)).dateKey;
      const slots = listSlots({
        dateKey: key,
        now,
        leadMinutes: lead,
        hours: data.hours,
        closures: data.closures,
        hasUncertainItems: hasUncertain,
        uncertainItemsCutoff: data.settings.uncertainItemsCutoff,
        slotStartOffsetMinutes: data.settings.slotStartOffsetMinutes,
        slotEndOffsetMinutes: data.settings.slotEndOffsetMinutes,
        noticeDays,
      });
      if (slots.length) {
        if (i < dayCount) openDaysInWindow++;
        // e.g. "Tomorrow · Fri, Nov 6", "Sat, Nov 7"
        const date = new Date(`${key}T12:00:00+08:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" });
        const label = i === 0 ? `Today · ${date}` : i === 1 ? `Tomorrow · ${date}` : date;
        const short = dailyLimitShortfalls(limited, data.booked, key);
        if (short.length) full.push({ label: date, reason: shortfallMessage(short, date) });
        else result.push({ dateKey: key, label, slots });
      }
    }
    return { days: result, fullDays: full, overLimit: over };
  }, [now, lead, hasUncertain, noticeDays, data, lines]);

  // The chosen date/time, falling back to the first valid one as lead time and the clock change.
  const day = days.find((d) => d.dateKey === dateKey) ?? days[0];
  const slot = day?.slots.some((s) => s.toISOString() === slotIso) ? slotIso : (day?.slots[0]?.toISOString() ?? "");

  // Delivery quote whenever the pin or barangay changes.
  useEffect(() => {
    if (!quoteKey || !pin) return;
    const controller = new AbortController();
    const setQuote = (value: QuoteState) => setQuoteResult({ key: quoteKey, value });
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/delivery/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: data.store.id, lat: pin.lat, lng: pin.lng, barangayId, subtotal }),
          signal: controller.signal,
        });
        const json = (await res.json()) as { ok: true; quote: DeliveryQuote; estimated: boolean } | { ok: false; error: string };
        setQuote(json.ok ? { status: "ok", quote: json.quote, estimated: json.estimated } : { status: "error", error: json.error });
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuote({ status: "error", error: "Couldn't check the delivery fee. Try again." });
      }
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [quoteKey, pin, barangayId, subtotal, data.store.id]);

  function chooseSaved(id: string) {
    setSavedId(id);
    const a = data.savedAddresses.find((x) => x.id === id);
    if (a) {
      setBarangayId(a.barangayId);
      setStreetPurok(a.streetPurok);
      setLandmark(a.landmark);
      setRiderNotes(a.riderNotes);
      setPin({ lat: a.lat, lng: a.lng });
      setFocus({ lat: a.lat, lng: a.lng });
      setSaveAddress(false);
    } else {
      setPin(null);
      setSaveAddress(Boolean(data.customer));
    }
  }

  function chooseBarangay(id: string) {
    setBarangayId(id);
    const center = data.barangays.find((b) => b.id === id)?.center;
    if (center) setFocus(center);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setErrors(["Your browser can't share its location. Tap the map instead."]);
    setLocating(true);
    setLocationNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPin(p);
        setFocus(p);
        if (savedId !== "new") setSavedId("new");
        void fillAddressFrom(p).finally(() => setLocating(false));
      },
      () => {
        setLocating(false);
        setErrors(["Couldn't get your location. Tap the map to place the pin."]);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  /**
   * Fills the barangay (and purok/street and landmark, if still empty) from the pin's address on
   * OpenStreetMap. Anything it can't find stays for the customer to fill in.
   */
  async function fillAddressFrom(p: LatLng) {
    try {
      const res = await fetch("/api/address/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: data.store.id, lat: p.lat, lng: p.lng }),
      });
      const guess = (await res.json()) as { ok: boolean; barangayId: string | null; streetPurok: string | null; landmark: string | null };
      if (!guess.ok) throw new Error("lookup failed");
      if (guess.barangayId) setBarangayId(guess.barangayId);
      if (guess.streetPurok) setStreetPurok((current) => (current.trim() ? current : guess.streetPurok!));
      if (guess.landmark) setLandmark((current) => (current.trim() ? current : guess.landmark!));
      setLocationNote(
        guess.barangayId
          ? guess.streetPurok
            ? "We filled in your address from your location. Please check it."
            : "We filled in your barangay. Please add your purok or street."
          : "Pin placed. Please choose your barangay and add your purok or street.",
      );
    } catch {
      setLocationNote("Pin placed. Please choose your barangay and add your purok or street.");
    }
  }

  function submit() {
    const problems: string[] = [];
    if (!name.trim()) problems.push("Enter your name");
    if (!phone.trim()) problems.push("Enter your mobile number");
    if (fulfillment === "delivery") {
      if (!barangayId) problems.push("Choose your barangay");
      if (!pin) problems.push("Place the pin on the map");
      if (quote.status === "error") problems.push(quote.error);
    }
    if (!slot) problems.push("Choose a pickup or delivery time");
    if (!consent) problems.push("Please agree to the privacy notice");
    setErrors(problems);
    if (problems.length) return;

    startTransition(async () => {
      const result = await placeOrder({
        store: data.store.slug,
        cart: lines.map(({ lineId, productId, qty, weightKg, modifierIds, notes }) => ({ lineId, productId, qty, weightKg, modifierIds, notes })),
        name,
        phone,
        fulfillment,
        scheduledFor: slot,
        address:
          fulfillment === "delivery" && pin
            ? { barangayId, streetPurok, landmark, riderNotes, lat: pin.lat, lng: pin.lng, save: saveAddress }
            : null,
        consent: true,
      });
      if (result.ok) {
        rememberOrder({ code: result.code, url: result.url, placedAt: new Date().toISOString(), store: data.store.slug });
        cart.clear();
        router.push(result.url);
      } else {
        setErrors(result.errors);
      }
    });
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-xl border border-ink-200 bg-surface p-6 text-center dark:border-ink-800 dark:bg-ink-900">
        <p className="mb-4 text-muted">Your cart is empty.</p>
        <Link href={`/s/${data.store.slug}`} className="rounded-lg bg-accent-button px-4 py-2 text-sm font-medium text-on-accent">
          Browse the menu
        </Link>
      </div>
    );
  }

  if (data.settings.orderingPaused) {
    return <p className="rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-200">Online ordering is paused for a while. Please try again later.</p>;
  }

  const section = "mb-5 rounded-xl border border-ink-200 bg-surface p-4 dark:border-ink-800 dark:bg-ink-900";

  return (
    <div>
      {/* Cart */}
      <section className={section}>
        <h2 className="mb-3 font-semibold">Your order</h2>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {lines.map((l) => (
            <CartLineRow key={l.lineId} line={l} item={data.menuItems[l.productId]} cart={cart} onEdit={() => setEditing(l)} />
          ))}
        </ul>
        {editing && data.menuItems[editing.productId] && (
          <OptionsSheet item={data.menuItems[editing.productId]!} initial={editing} onClose={() => setEditing(null)} onAdd={cart.replace} />
        )}
      </section>

      {/* Customer */}
      <section className={section}>
        <h2 className="mb-3 font-semibold">Your details</h2>
        {!data.customer && (
          <p className="mb-3 rounded-lg bg-accent-soft p-3 text-sm text-foreground">
            {data.facebookLogin ? (
              <>
                <Link href={`/s/${data.store.slug}/login?next=/s/${data.store.slug}/checkout`} className="font-medium underline">
                  Log in with Facebook
                </Link>{" "}
                to save your details{data.offer === null ? " and get a welcome discount." : "."}
              </>
            ) : (
              "Ordering as a guest. Your details are only used for this order."
            )}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Name</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Mobile number</span>
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0917 123 4567" />
          </label>
        </div>
      </section>

      {/* Pickup / delivery */}
      <section className={section}>
        <h2 className="mb-3 font-semibold">{data.deliveryEnabled ? "Pickup or delivery" : "Pickup"}</h2>
        <div className={`mb-4 grid grid-cols-2 gap-2 ${data.deliveryEnabled ? "" : "hidden"}`}>
          {(["pickup", "delivery"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFulfillment(f)}
              disabled={f === "delivery" && !data.deliveryReady}
              className={`rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50 ${fulfillment === f ? "border-accent-button bg-accent-button text-on-accent" : "border-ink-300 dark:border-ink-700"}`}
            >
              {f === "pickup" ? "Pickup" : "Delivery"}
            </button>
          ))}
        </div>

        {fulfillment === "pickup" && (
          <p className="text-sm text-muted">
            Pick up at {data.settings.kitchenAddress ?? `${data.store.name}'s kitchen`}.
            {data.settings.pickupInstructions ? ` ${data.settings.pickupInstructions}` : ""}
          </p>
        )}
        {data.deliveryEnabled && !data.deliveryReady && <p className="text-xs text-muted">Delivery isn&apos;t available yet.</p>}

        {fulfillment === "delivery" && (
          <div className="flex flex-col gap-3">
            {data.savedAddresses.length > 0 && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Address</span>
                <select className={inputClass} value={savedId} onChange={(e) => chooseSaved(e.target.value)}>
                  {data.savedAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}: {a.streetPurok || data.barangays.find((b) => b.id === a.barangayId)?.name}
                    </option>
                  ))}
                  <option value="new">New address…</option>
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Barangay</span>
                <select className={inputClass} value={barangayId} onChange={(e) => chooseBarangay(e.target.value)}>
                  <option value="">Choose…</option>
                  {data.barangays.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Purok / street</span>
                <input className={inputClass} value={streetPurok} onChange={(e) => setStreetPurok(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Landmark</span>
                <input className={inputClass} value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. near the chapel" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Notes for the rider</span>
                <input className={inputClass} value={riderNotes} onChange={(e) => setRiderNotes(e.target.value)} />
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Tap the map to place your pin</span>
                <button type="button" onClick={useMyLocation} disabled={locating} className="text-sm underline decoration-ink-400 underline-offset-2 hover:decoration-accent dark:decoration-ink-500 disabled:opacity-60">
                  {locating ? "Locating…" : "Use my location"}
                </button>
              </div>
              {locationNote && (
                <p className="mb-2 text-sm text-muted" aria-live="polite">
                  {locationNote}
                </p>
              )}
              <MapPicker
                value={pin}
                focus={focus}
                kitchen={data.kitchen}
                onChange={(p) => {
                  setPin(p);
                  if (savedId !== "new") setSavedId("new");
                }}
              />
              <p className="mt-2 text-sm" aria-live="polite">
                {quote.status === "loading" && <span className="text-muted">Checking delivery fee…</span>}
                {quote.status === "ok" && (
                  <span>
                    Delivery fee <strong>{peso(quote.quote.fee)}</strong> · about {quote.quote.distanceKm} km
                    {quote.estimated ? " (estimated)" : ""}
                  </span>
                )}
                {quote.status === "error" && <span className="text-red-700 dark:text-red-400">{quote.error}</span>}
              </p>
            </div>

            {data.customer && savedId === "new" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-accent-button" />
                Save this address for next time
              </label>
            )}
          </div>
        )}
      </section>

      {/* Time */}
      <section className={section}>
        <h2 className="mb-3 font-semibold">{fulfillment === "pickup" ? "Pickup time" : "Delivery time"}</h2>
        {overLimit.length > 0 ? (
          <p className="rounded-lg bg-kraft-soft p-3 text-sm text-foreground">
            {overLimit.map((o) => `We make at most ${o.left} ${o.name} a day. Please order ${o.left} or fewer.`).join(" ")}
          </p>
        ) : !now ? (
          <p className="text-sm text-muted">Loading times…</p>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted">
            {fullDays.length > 0
              ? "Your order is fully booked on every day we can offer right now. Try fewer pieces, or check back later."
              : "No times available right now. Please check back during opening hours."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Day</span>
              <select className={inputClass} value={day?.dateKey ?? ""} onChange={(e) => setDateKey(e.target.value)}>
                {days.map((d) => (
                  <option key={d.dateKey} value={d.dateKey}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Time</span>
              <select className={inputClass} value={slot} onChange={(e) => setSlotIso(e.target.value)}>
                {day?.slots.map((s) => (
                  <option key={s.toISOString()} value={s.toISOString()}>
                    {formatManilaTime(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {fullDays.length > 0 && (
          <p className="mt-3 rounded-lg bg-kraft-soft p-3 text-sm text-foreground">
            Not offered because they&apos;re fully booked:{" "}
            {fullDays
              .slice(0, 3)
              .map((d) => d.reason)
              .join(". ")}
            {fullDays.length > 3 ? `, and ${fullDays.length - 3} more day${fullDays.length - 3 === 1 ? "" : "s"}` : ""}.
          </p>
        )}
        {noticeDays > 0 && (
          <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm text-foreground">
            {noticeItems.map((l) => l.name).join(", ")} {noticeItems.length === 1 ? "is" : "are"} made to order and need{noticeItems.length === 1 ? "s" : ""}{" "}
            {noticeDays === 1 ? "1 day" : `${noticeDays} days`}&apos; notice, so the whole order comes on that date.
            {noticeItems.length < lines.length && " Want the other food sooner? Place it as a separate order."}
          </p>
        )}
        {hasUncertain && (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">
            Your order has items that depend on availability or market price. We&apos;ll confirm them and the final price first, then you pay.
          </p>
        )}
      </section>

      {/* Summary */}
      <section className="ticket-card mb-5 p-4">
        <h2 className="mb-3 font-semibold">Summary</h2>
        <dl className="flex flex-col gap-1 text-sm">
          <Row label="Subtotal" value={`${isEstimate ? "~" : ""}${peso(subtotal)}`} />
          {discount > 0 && <Row label={data.offer!.name} value={`−${peso(discount)}`} />}
          {data.offer && discount === 0 && data.offer.minOrder !== null && (
            <p className="text-xs text-muted">
              {data.offer.name} applies from {peso(data.offer.minOrder)}.
            </p>
          )}
          {fulfillment === "delivery" && <Row label="Delivery fee" value={quote.status === "ok" ? peso(deliveryFee) : "—"} />}
          <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 text-base font-semibold dark:border-ink-700">
            <dt>Total</dt>
            <dd>
              {isEstimate ? "~" : ""}
              {peso(total)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">Payment: GCash, after we confirm your order.</p>

        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-accent-button" />
          <span>
            I agree to the{" "}
            <Link href={`/privacy?store=${data.store.slug}`} className="underline" target="_blank">
              privacy notice
            </Link>
            . My name, number and address are used only for this order.
          </span>
        </label>

        {errors.length > 0 && (
          <ul className="mt-3 list-disc rounded-lg bg-red-50 p-3 pl-6 text-sm text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="mt-4 w-full rounded-xl bg-accent-button px-4 py-3 font-medium text-on-accent hover:brightness-95 disabled:opacity-60"
        >
          {pending ? "Placing order…" : `Place order · ${isEstimate ? "~" : ""}${peso(total)}`}
        </button>
      </section>

      {data.store.facebookUrl && <FacebookPrompt url={data.store.facebookUrl} storeName={data.store.name} />}
    </div>
  );
}

/** One cart line: base price, each add-on with its price, notes, quantity and an edit button. */
function CartLineRow({ line: l, item, cart, onEdit }: { line: CartEntry; item: MenuItem | undefined; cart: Cart; onEdit: () => void }) {
  const tilde = l.isEstimate ? "~" : "";
  // Add-ons priced from the current menu; items no longer on the menu fall back to the saved labels.
  const options = item?.groups.flatMap((g) => g.options).filter((o) => l.modifierIds.includes(o.id));
  const basis = item ? (item.priceMode === "market" ? (item.price ?? item.estimatedPrice) : item.price) : null;
  const hasAddOns = item?.groups.some((g) => g.options.length > 0) ?? false;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {l.qty > 1 && <span className="text-muted">{l.qty}× </span>}
          {l.name}
        </p>
        <span className="shrink-0 text-sm font-semibold">
          {tilde}
          {peso(l.displayUnitPrice * l.qty)}
        </span>
      </div>

      {options ? (
        <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted">
          {basis !== null && (
            <li className="flex justify-between gap-3">
              <span>{l.weightKg ? `${l.weightKg} kg` : "Base price"}</span>
              <span>
                {tilde}
                {peso(basis * (l.weightKg ?? 1))}
              </span>
            </li>
          )}
          {options.map((o) => (
            <li key={o.id} className="flex justify-between gap-3">
              <span>+ {o.name}</span>
              <span>{o.priceDelta > 0 ? `+${peso(o.priceDelta)}` : "free"}</span>
            </li>
          ))}
        </ul>
      ) : (
        l.optionLabels.length > 0 && <p className="mt-1 text-sm text-muted">{l.optionLabels.join(" · ")}</p>
      )}
      {l.notes && <p className="mt-1 whitespace-pre-line text-sm text-muted">“{l.notes}”</p>}
      {l.needsAvailability && (
        <span className="mt-1 inline-block">
          <Badge tone="amber">Confirmed before you pay</Badge>
        </span>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-ink-300 text-sm dark:border-ink-700">
            <button type="button" className="flex min-h-11 min-w-11 items-center justify-center" onClick={() => cart.setQty(l.lineId, l.qty - 1)} aria-label={`One less ${l.name}`}>
              −
            </button>
            <span className="w-6 text-center">{l.qty}</span>
            <button type="button" className="flex min-h-11 min-w-11 items-center justify-center" onClick={() => cart.setQty(l.lineId, l.qty + 1)} aria-label={`One more ${l.name}`}>
              +
            </button>
          </div>
          {l.qty > 1 && (
            <span className="text-xs text-muted">
              {tilde}
              {peso(l.displayUnitPrice)} each
            </span>
          )}
        </div>
        {item && (
          <button type="button" onClick={onEdit} className="text-sm font-medium underline decoration-ink-400 underline-offset-2 hover:decoration-accent dark:decoration-ink-500">
            {hasAddOns ? (options?.length ? "Change add-ons" : "Add add-ons") : "Edit"}
          </button>
        )}
      </div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
