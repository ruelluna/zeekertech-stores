import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader, PesoInput } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { saveBarangay, saveDeliverySettings } from "./actions";
import { FeePreview } from "./fee-preview";
import { KitchenPin } from "./kitchen-pin";
import { DAANBANTAYAN_CENTER } from "@/lib/catalog";

export default function DeliveryPage() {
  return (
    <>
      <PageHeader
        title="Delivery"
        description="The fee is calculated from road distance at checkout; staff can still change it on an order."
      />
      <Suspense fallback={<Loading />}>
        <DeliveryContent />
      </Suspense>
    </>
  );
}

async function DeliveryContent() {
  const { supabase, storeId } = await requireOwner();
  const store = supabase.schema("store");
  const [{ data: s, error: sError }, { data: barangays, error: bError }] = await Promise.all([
    store.from("delivery_settings").select("*").eq("store_id", storeId).single(),
    store.from("barangays").select("id, name, active, fee_override, surcharge, notes, is_island").eq("store_id", storeId).order("sort_order"),
  ]);
  if (sError || bError) throw sError ?? bError;

  const hasKitchenPin = s.kitchen_lat !== null && s.kitchen_lng !== null;

  return (
    <>
      <Card title="Delivery fee" description="fee = base fee + per-km rate × (distance − km included), rounded up, never below the minimum.">
        <ActionForm action={saveDeliverySettings} submitLabel="Save rates and kitchen location">
          <Checkbox
            name="delivery_enabled"
            label="Offer delivery (untick for pickup only). Delivery also needs the kitchen location below."
            defaultChecked={s.delivery_enabled}
          />
          <Field
            label="Delivery area"
            hint="Shown on the menu (“delivery in …”) and when an address is outside it. Leave blank to just say “delivery”."
          >
            <Input name="area_name" defaultValue={s.area_name ?? ""} maxLength={80} placeholder="e.g. mainland Daanbantayan" />
          </Field>
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

          <h3 className="mt-2 font-medium">Rider pay</h3>
          <p className="-mt-2 text-sm text-muted">
            Riders earn a share of each delivery fee; the rest stays with the store. Pay is fixed when an order goes out for delivery, so
            changes apply to new deliveries only. Add-on orders on the same trip earn nothing extra.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Rider share of the delivery fee (%)" hint={`Store keeps ${100 - Number(s.rider_share_percent)}%`}>
              <Input name="rider_share_percent" type="number" step="1" min="0" max="100" defaultValue={s.rider_share_percent} required />
            </Field>
            <Field label="Minimum rider pay per delivery" hint="Also applies when the delivery fee is waived. 0 = off.">
              <PesoInput name="rider_min_pay" defaultValue={s.rider_min_pay} required />
            </Field>
          </div>

          <h3 className="mt-2 font-medium">Kitchen location</h3>
          <p className="-mt-2 text-sm text-muted">Distances are measured from here. Tap the map on the kitchen, or paste the numbers from Google Maps.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Address" className="sm:col-span-3">
              <Input name="kitchen_address" defaultValue={s.kitchen_address ?? ""} />
            </Field>
            <KitchenPin
              initial={s.kitchen_lat !== null && s.kitchen_lng !== null ? { lat: s.kitchen_lat, lng: s.kitchen_lng } : null}
              fallbackCenter={DAANBANTAYAN_CENTER}
            />
            {!hasKitchenPin && <Badge tone="amber">Kitchen pin not set</Badge>}
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
        description="Untick a barangay to pause deliveries there. A fixed fee replaces the formula; a surcharge is added on top of it."
      >
        {s.service_area_geojson === null && (
          <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            This store has no delivery area map yet, so addresses aren&apos;t checked against a boundary. Ask the site admin to load one before
            turning delivery on.
          </p>
        )}
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
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
