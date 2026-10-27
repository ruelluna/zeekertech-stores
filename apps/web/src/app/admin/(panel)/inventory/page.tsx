import Link from "next/link";
import { Suspense } from "react";
import { manilaParts } from "@wfh/shared";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { loadInventory, type InventoryRow } from "@/lib/inventory";
import { saveCounts, saveItem } from "./actions";

export default function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Count stock at opening (beginning) and closing (ending). Usage and the buy list are worked out from the counts."
      />
      <Suspense fallback={<Loading />}>
        <Inventory searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const shiftDate = (dateKey: string, days: number) => {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00+08:00`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Manila" });
const qty = (n: number | null, unit: string) => (n === null ? "—" : `${Math.round(n * 100) / 100} ${unit}`);

async function Inventory({ searchParams }: { searchParams: PageProps<"/admin/inventory">["searchParams"] }) {
  const { supabase, role } = await requireStaff();
  const params = await searchParams;
  const today = manilaParts(new Date()).dateKey;
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const rows = await loadInventory(supabase, date, role === "owner");
  const active = rows.filter((r) => r.active);
  const toBuy = active.filter((r) => r.suggestion.status === "buy");
  const notSet = active.filter((r) => r.suggestion.status === "unknown");
  const categories = [...new Set(active.map((r) => r.category))];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/admin/inventory?date=${shiftDate(date, -1)}`} className="rounded-lg border border-stone-300 px-3 py-1.5 dark:border-stone-700">
          ← Previous day
        </Link>
        <strong className="text-base">{prettyDate(date)}</strong>
        {date !== today && (
          <Link href="/admin/inventory" className="text-orange-700 underline">
            Today
          </Link>
        )}
        {date < today && (
          <Link href={`/admin/inventory?date=${shiftDate(date, 1)}`} className="rounded-lg border border-stone-300 px-3 py-1.5 dark:border-stone-700">
            Next day →
          </Link>
        )}
      </div>

      <Card
        title={`🛒 To buy${date === today ? " for tomorrow" : ""} (${toBuy.length})`}
        description="Based on tonight's ending count (or this morning's count plus purchases until then), each item's target, reorder point and average daily use."
      >
        {toBuy.length === 0 ? (
          <p className="text-sm text-stone-500">Nothing to buy based on the counts so far.</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {toBuy.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <strong>{r.name}</strong> <span className="text-stone-500">· {r.suggestion.reason}</span>
                </span>
                <Badge tone="amber">
                  Buy {r.suggestion.quantity} {r.unit}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {notSet.length > 0 && (
          <p className="mt-3 text-xs text-stone-500">
            No suggestion yet for {notSet.length} item{notSet.length === 1 ? "" : "s"} ({notSet.map((r) => r.name).slice(0, 4).join(", ")}
            {notSet.length > 4 ? "…" : ""}): count them for a couple of days or set a target below.
          </p>
        )}
      </Card>

      <Card title="Daily count" description="Beginning is carried over from the previous day's ending; change it if the morning count differs. Leave a row blank to skip it.">
        <ActionForm action={saveCounts} submitLabel="Save counts">
          <input type="hidden" name="date" value={date} />
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{category}</h3>
              <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
                {active
                  .filter((r) => r.category === category)
                  .map((r) => (
                    <CountRow key={r.id} r={r} />
                  ))}
              </div>
            </div>
          ))}
        </ActionForm>
      </Card>

      {role === "owner" && (
        <Card title="Items" description="Target = stock to start a day with. Reorder at = alert when the ending count drops to this. Buy for = days one purchase covers.">
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <details key={r.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                <summary className="cursor-pointer text-sm">
                  <strong>{r.name}</strong>{" "}
                  <span className="text-stone-500">
                    · {r.unit} · target {qty(r.parLevel, r.unit)} · reorder at {qty(r.reorderPoint, r.unit)} · buy for {r.buyForDays} day
                    {r.buyForDays === 1 ? "" : "s"}
                  </span>{" "}
                  {!r.active && <Badge>Hidden</Badge>}
                </summary>
                <ItemForm r={r} />
              </details>
            ))}
            <details className="rounded-lg border border-dashed border-stone-300 p-3 dark:border-stone-700">
              <summary className="cursor-pointer text-sm font-medium text-orange-700">+ Add item</summary>
              <ItemForm />
            </details>
          </div>
        </Card>
      )}
    </>
  );
}

function CountRow({ r }: { r: InventoryRow }) {
  const cell = "w-24";
  return (
    <div className="flex flex-wrap items-end gap-3 py-3">
      <input type="hidden" name="itemId" value={r.id} />
      <div className="min-w-40 flex-1">
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-stone-500">
          Used today: {qty(r.usage, r.unit)} · avg {qty(r.avgUsage, r.unit)}/day
          {r.suggestion.status === "buy" && (
            <>
              {" "}
              · <span className="text-amber-700 dark:text-amber-400">buy {r.suggestion.quantity} {r.unit}</span>
            </>
          )}
        </p>
      </div>
      <Field label={`Beginning${r.beginningIsCarried ? " (carried)" : ""}`} className={cell}>
        <Input name={`beginning_${r.id}`} type="number" step="0.01" min="0" defaultValue={r.beginning ?? ""} />
      </Field>
      <Field label="Received" className={cell}>
        <Input name={`received_${r.id}`} type="number" step="0.01" min="0" defaultValue={r.received || ""} />
      </Field>
      <Field label="Wasted" className={cell}>
        <Input name={`wasted_${r.id}`} type="number" step="0.01" min="0" defaultValue={r.wasted || ""} />
      </Field>
      <Field label={`Ending (${r.unit})`} className={cell}>
        <Input name={`ending_${r.id}`} type="number" step="0.01" min="0" defaultValue={r.ending ?? ""} />
      </Field>
    </div>
  );
}

function ItemForm({ r }: { r?: InventoryRow }) {
  return (
    <ActionForm action={saveItem} submitLabel={r ? "Save item" : "Add item"} className="mt-3 flex flex-col gap-3">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Name" className="sm:col-span-2">
          <Input name="name" defaultValue={r?.name ?? ""} required />
        </Field>
        <Field label="Unit" hint="kg, pcs, pack, liter…">
          <Input name="unit" defaultValue={r?.unit ?? "pcs"} required />
        </Field>
        <Field label="Category">
          <Input name="category" defaultValue={r?.category ?? ""} placeholder="e.g. Seafood" />
        </Field>
        <Field label="Target (start of day)">
          <Input name="par_level" type="number" step="0.01" min="0" defaultValue={r?.parLevel ?? ""} />
        </Field>
        <Field label="Reorder at">
          <Input name="reorder_point" type="number" step="0.01" min="0" defaultValue={r?.reorderPoint ?? ""} />
        </Field>
        <Field label="Buy for (days)">
          <Input name="buy_for_days" type="number" min="1" max="14" defaultValue={r?.buyForDays ?? 1} />
        </Field>
        <Field label="Order in list">
          <Input name="sort_order" type="number" defaultValue={r?.sortOrder ?? 0} />
        </Field>
        <Field label="Notes (supplier, etc.)" className="sm:col-span-3">
          <Input name="notes" defaultValue={r?.notes ?? ""} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="active" label="Counted daily" defaultChecked={r?.active ?? true} />
        </div>
      </div>
    </ActionForm>
  );
}
