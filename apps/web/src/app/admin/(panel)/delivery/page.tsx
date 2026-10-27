import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader, PesoInput } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { saveBarangay, saveDeliverySettings } from "./actions";
import { FeePreview } from "./fee-preview";

export default function DeliveryPage() {
  return (
    <>
      <PageHeader
        title="Delivery"
        description="Mainland Daanbantayan only. The fee is calculated from road distance at checkout; staff can still change it on an order."
      />
      <Suspense fallback={<Loading />}>
        <DeliveryContent />
      </Suspense>
    </>
  );
}

async function DeliveryContent() {
  const { supabase } = await requireOwner();
  const store = supabase.schema("store");
  const [{ data: s, error: sError }, { data: barangays, error: bError }] = await Promise.all([
    store.from("delivery_settings").select("*").eq("id", true).single(),
    store.from("barangays").select("id, name, active, fee_override, surcharge, notes, is_island").order("sort_order"),
  ]);
  if (sError || bError) throw sError ?? bError;

  const mapsLink =
    s.kitchen_lat !== null && s.kitchen_lng !== null
      ? `https://www.openstreetmap.org/?mlat=${s.kitchen_lat}&mlon=${s.kitchen_lng}#map=17/${s.kitchen_lat}/${s.kitchen_lng}`
      : null;

  return (
    <>
      <Card title="Delivery fee" description="fee = base fee + per-km rate × (distance − km included), rounded up, never below the minimum.">
        <ActionForm action={saveDeliverySettings} submitLabel="Save rates and kitchen location">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Base fee">
              <PesoInput name="base_fee" defaultValue={s.base_fee} required />
            </Field>
            <Field label="Km included in base fee">
              <Input name="included_km" type="number" step="0.1" min="0" defaultValue={s.included_km} required />
            </Field>
            <Field label="Per km after that">
              <PesoInput name="per_km" defaultValue={s.per_km} required />
            </Field>
            <Field label="Round up to nearest">
              <PesoInput name="round_to" defaultValue={s.round_to} required />
            </Field>
            <Field label="Minimum fee">
              <PesoInput name="min_fee" defaultValue={s.min_fee} required />
            </Field>
            <Field label="Maximum distance (km)">
              <Input name="max_km" type="number" step="0.1" min="0" defaultValue={s.max_km} required />
            </Field>
            <Field label="Free delivery from" hint="Order subtotal. Leave blank to turn off.">
              <PesoInput name="free_delivery_threshold" defaultValue={s.free_delivery_threshold} />
            </Field>
          </div>

          <h3 className="mt-2 font-medium">Kitchen location</h3>
          <p className="-mt-2 text-sm text-stone-600 dark:text-stone-400">
            Distances are measured from here. In Google Maps, long-press the kitchen and copy the two numbers shown (latitude, longitude). A map
            picker comes with checkout.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Address" className="sm:col-span-3">
              <Input name="kitchen_address" defaultValue={s.kitchen_address ?? ""} />
            </Field>
            <Field label="Latitude" hint="e.g. 11.2xxxxx">
              <Input name="kitchen_lat" type="number" step="any" defaultValue={s.kitchen_lat ?? ""} />
            </Field>
            <Field label="Longitude" hint="e.g. 124.0xxxxx">
              <Input name="kitchen_lng" type="number" step="any" defaultValue={s.kitchen_lng ?? ""} />
            </Field>
            <div className="flex items-end pb-2 text-sm">
              {mapsLink ? (
                <a href={mapsLink} target="_blank" rel="noreferrer" className="text-orange-700 underline">
                  Check the pin on a map
                </a>
              ) : (
                <Badge tone="amber">Kitchen pin not set</Badge>
              )}
            </div>
          </div>
        </ActionForm>
      </Card>

      <Card title="Try a distance" description="Uses the saved rates above.">
        <FeePreview
          settings={{
            baseFee: s.base_fee,
            includedKm: s.included_km,
            perKm: s.per_km,
            roundTo: s.round_to,
            minFee: s.min_fee,
            maxKm: s.max_km,
            freeDeliveryThreshold: s.free_delivery_threshold,
          }}
        />
      </Card>

      <Card
        title="Barangays"
        description="Untick a barangay to pause deliveries there. A fixed fee replaces the formula; a surcharge is added on top of it. Islands (Carnaza, Malapascua) aren't served."
      >
        {s.service_area_geojson === null && (
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            The Daanbantayan map boundary isn&apos;t loaded yet. It&apos;s imported before checkout goes live (Phase 2).
          </p>
        )}
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {barangays.map((b) => (
            <li key={b.id} className="py-3">
              <ActionForm action={saveBarangay} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={b.id} />
                <div className="w-32 pb-2">
                  <Checkbox name="active" label={b.name} defaultChecked={b.active} />
                </div>
                <Field label="Fixed fee" className="w-28">
                  <PesoInput name="fee_override" defaultValue={b.fee_override} />
                </Field>
                <Field label="Surcharge" className="w-28">
                  <PesoInput name="surcharge" defaultValue={b.surcharge} />
                </Field>
                <Field label="Notes" className="min-w-48 flex-1">
                  <Input name="notes" defaultValue={b.notes ?? ""} />
                </Field>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
