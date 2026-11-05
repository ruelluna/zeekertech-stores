import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, Checkbox, Field, Input, Loading, PageHeader, Textarea } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { getStoreById } from "@/lib/stores";
import { DEFAULT_ACCENT } from "@wfh/shared";
import { AccentPicker } from "@/components/accent-picker";
import {
  addClosure,
  removeClosure,
  removeStoreLogo,
  saveHours,
  savePrintSettings,
  saveStoreProfile,
  saveStoreSettings,
  uploadGcashQr,
  uploadStoreLogo,
} from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (t: string) => t.slice(0, 5);

export default function HoursPage() {
  return (
    <>
      <PageHeader
        title="Hours & settings"
        description="Customers can place orders during opening hours. Pickup and delivery times start and end inside them (set below)."
      />
      <Suspense fallback={<Loading />}>
        <HoursContent />
      </Suspense>
    </>
  );
}

async function HoursContent() {
  const { supabase, storeId } = await requireOwner();
  const store = supabase.schema("store");
  const [hours, closures, settings, profile] = await Promise.all([
    store.from("store_hours").select("*").eq("store_id", storeId).order("day_of_week"),
    store.from("store_closures").select("*").eq("store_id", storeId).order("date"),
    store.from("store_settings").select("*").eq("store_id", storeId).single(),
    getStoreById(storeId),
  ]);
  if (hours.error || closures.error || settings.error) throw hours.error ?? closures.error ?? settings.error;
  const s = settings.data;

  return (
    <>
      <Card title="Store" description="Shown on the store's menu.">
        <ActionForm action={saveStoreProfile} className="flex flex-wrap items-end gap-3">
          <Field label="Store name" className="w-64">
            <Input name="name" defaultValue={profile?.name ?? ""} required />
          </Field>
          <Field label="Tagline" className="min-w-64 flex-1">
            <Input name="tagline" defaultValue={profile?.tagline ?? ""} placeholder="e.g. Made-to-order cakes and pastries" />
          </Field>
          <Field
            label="How customers contact you"
            hint="Facebook Page link or mobile number. Shown at the bottom of the menu and on the privacy page, for questions, refunds and data requests."
            className="w-full"
          >
            <Input name="contact" defaultValue={profile?.contact ?? ""} maxLength={200} placeholder="e.g. facebook.com/yourstore or 0917 123 4567" />
          </Field>
          <AccentPicker defaultValue={profile?.accent_color ?? DEFAULT_ACCENT} storeName={profile?.name ?? ""} />
        </ActionForm>
      </Card>

      <Card title="Logo" description="Optional. Shown at the top of the menu instead of the store name in script. A wide logo on a transparent background works best.">
        <div className="flex flex-wrap items-start gap-6">
          {profile?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo_url} alt="Current logo" className="max-h-20 max-w-60 object-contain" />
          ) : (
            <p className="font-script text-3xl leading-none">{profile?.name}</p>
          )}
          <div className="flex flex-col gap-3">
            <ActionForm action={uploadStoreLogo} submitLabel="Upload logo">
              <input type="file" name="logo" accept="image/*" required className="text-sm" />
            </ActionForm>
            {profile?.logo_url && <ActionForm action={removeStoreLogo} submitLabel="Use the name instead" variant="secondary" />}
          </div>
        </div>
      </Card>

      <Card title="Ordering hours" description="Manila time.">
        <ActionForm action={saveHours} submitLabel="Save hours">
          <div className="flex flex-col gap-2">
            {DAYS.map((name, day) => {
              const row = hours.data.find((h) => h.day_of_week === day);
              return (
                <div key={day} className="flex flex-wrap items-center gap-3">
                  <div className="w-32">
                    <Checkbox name={`is_open_${day}`} label={name} defaultChecked={row?.is_open ?? false} />
                  </div>
                  <Input name={`opens_at_${day}`} type="time" defaultValue={hhmm(row?.opens_at ?? "13:00")} className="w-32" aria-label={`${name} opens`} />
                  <span className="text-sm text-muted">to</span>
                  <Input name={`closes_at_${day}`} type="time" defaultValue={hhmm(row?.closes_at ?? "21:00")} className="w-32" aria-label={`${name} closes`} />
                </div>
              );
            })}
          </div>
        </ActionForm>
      </Card>

      <Card title="Closed dates" description="Holidays and days off. The menu shows when you open next.">
        {closures.data.length === 0 && <p className="mb-3 text-sm text-muted">No closed dates.</p>}
        <ul className="mb-3 flex flex-col gap-2">
          {closures.data.map((c) => (
            <li key={c.date}>
              <ActionForm action={removeClosure} submitLabel="Remove" danger className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="date" value={c.date} />
                <span className="w-56 text-sm">
                  <strong>{c.date}</strong> {c.reason && <span className="text-muted">· {c.reason}</span>}
                </span>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={addClosure} submitLabel="Add closed date" className="flex flex-wrap items-end gap-3 border-t border-ink-100 pt-3 dark:border-ink-800">
          <Field label="Date" className="w-44">
            <Input name="date" type="date" required />
          </Field>
          <Field label="Reason (optional)" className="w-56">
            <Input name="reason" placeholder="e.g. Fiesta" />
          </Field>
        </ActionForm>
      </Card>

      <Card title="Ordering settings">
        <ActionForm action={saveStoreSettings}>
          <div className="flex flex-col gap-2">
            <Checkbox name="ordering_paused" label="Pause online ordering now (busy or short-staffed)" defaultChecked={s.ordering_paused} />
            <Checkbox name="allow_preorders" label="Allow pre-orders outside opening hours" defaultChecked={s.allow_preorders} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First pickup/delivery (min after opening)" hint="60 = 1 hour: 1 PM opening → first time 2 PM">
              <Input name="slot_start_offset_minutes" type="number" min="0" max="600" step="15" defaultValue={s.slot_start_offset_minutes} />
            </Field>
            <Field label="Last pickup/delivery (min before closing)" hint="60 = 1 hour: 9 PM closing → last time 8 PM">
              <Input name="slot_end_offset_minutes" type="number" min="0" max="600" step="15" defaultValue={s.slot_end_offset_minutes} />
            </Field>
            <div />
            <Field label="Default prep time (min)" hint="Used when a product has no prep time">
              <Input name="prep_lead_minutes" type="number" min="0" defaultValue={s.prep_lead_minutes} />
            </Field>
            <Field label="Delivery buffer (min)" hint="Added to drive time for the cutoff">
              <Input name="delivery_buffer_minutes" type="number" min="0" defaultValue={s.delivery_buffer_minutes} />
            </Field>
            <Field label="Crab/shrimp same-day cutoff" hint="Uncertain items after this are next-day only">
              <Input name="uncertain_items_cutoff" type="time" defaultValue={hhmm(s.uncertain_items_cutoff)} />
            </Field>
            <Field label="Customer reply time (min)" hint="After availability is confirmed">
              <Input name="customer_decision_minutes" type="number" min="0" defaultValue={s.customer_decision_minutes} />
            </Field>
            <Field label="Flag unpaid after (min)">
              <Input name="unpaid_flag_minutes" type="number" min="0" defaultValue={s.unpaid_flag_minutes} />
            </Field>
            <Field label="Advance notice (days)" hint="Made-to-order: earliest pickup/delivery is this many days ahead. 0 = same day.">
              <Input name="notice_days" type="number" min="0" max="60" defaultValue={s.notice_days} />
            </Field>
            <Field label="GCash account name" hint="Shown next to the QR at checkout">
              <Input name="gcash_account_name" defaultValue={s.gcash_account_name ?? ""} />
            </Field>
            <Field label="Pickup instructions" className="sm:col-span-3" hint="Where to pick up, landmark, parking">
              <Textarea name="pickup_instructions" defaultValue={s.pickup_instructions ?? ""} />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <Card
        title="Printing"
        description="Item labels are the kitchen printout: one per item, showing the order code, customer, product, options, notes and payment. They print from the browser to any printer the device has. In the print dialog, choose the label printer, turn off headers/footers and set margins to none."
      >
        <ActionForm action={savePrintSettings} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Label width (mm)">
              <Input name="print_label_width_mm" type="number" step="0.5" min="20" max="120" defaultValue={s.print_label_width_mm} />
            </Field>
            <Field label="Label height (mm)">
              <Input name="print_label_height_mm" type="number" step="0.5" min="15" max="120" defaultValue={s.print_label_height_mm} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox name="print_labels_per_unit" label="One label per piece" defaultChecked={s.print_labels_per_unit} />
            </div>
          </div>
        </ActionForm>
      </Card>

      <Card title="GCash QR code" description="Customers scan this on their order page to pay. Use the QR from your GCash app (Receive → QR code → Save).">
        <div className="flex flex-wrap items-start gap-6">
          {s.gcash_qr_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.gcash_qr_url} alt="Current GCash QR" className="w-40 rounded-lg border border-ink-200" />
          ) : (
            <p className="w-40 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">No QR uploaded yet.</p>
          )}
          <ActionForm action={uploadGcashQr} submitLabel="Upload QR">
            <input type="file" name="qr" accept="image/*" required className="text-sm" />
          </ActionForm>
        </div>
      </Card>
    </>
  );
}
