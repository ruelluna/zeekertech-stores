import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader, PesoInput } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { saveCategory, setProductActive, updatePrice } from "./actions";

export default function MenuAdminPage() {
  return (
    <>
      <PageHeader
        title="Menu & prices"
        description="Products without a price stay hidden from ordering and show as “coming soon” on the menu."
        actions={
          <Link href="/admin/menu/new" className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
            Add product
          </Link>
        }
      />
      <Suspense fallback={<Loading />}>
        <MenuList />
      </Suspense>
    </>
  );
}

async function MenuList() {
  const { supabase, storeId } = await requireOwner();
  const store = supabase.schema("store");
  const [{ data: categories, error: catError }, { data: products, error: prodError }, { data: settings, error: settingsError }] = await Promise.all([
    store.from("categories").select("id, name, sort_order, active").eq("store_id", storeId).order("sort_order"),
    store
      .from("products")
      .select("id, sku, name, category_id, type, price_mode, sold_by, price, estimated_price, stock_tracked, active, sort_order, notice_days")
      .eq("store_id", storeId)
      .order("sort_order"),
    store.from("store_settings").select("notice_days").eq("store_id", storeId).single(),
  ]);
  if (catError || prodError || settingsError) throw catError ?? prodError ?? settingsError;

  return (
    <>
      {categories.map((category) => {
        const items = products.filter((p) => p.category_id === category.id);
        return (
          <Card key={category.id} title={category.name} description={category.active ? undefined : "Hidden from the menu"}>
            {items.length === 0 && <p className="text-sm text-stone-500">No products yet.</p>}
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {items.map((p) => {
                const market = p.price_mode === "market";
                const missingPrice = market ? p.price === null && p.estimated_price === null : p.price === null;
                return (
                  <li key={p.id} className="flex flex-wrap items-end gap-x-4 gap-y-2 py-3">
                    <div className="min-w-48 flex-1">
                      <Link href={`/admin/menu/${p.id}`} className="font-medium hover:text-orange-700">
                        {p.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                        <span>{p.sku}</span>
                        {market && <Badge tone="orange">Market price{p.sold_by === "weight" ? " · per kg" : ""}</Badge>}
                        {p.type === "frozen" && <Badge>Frozen</Badge>}
                        {p.stock_tracked && <Badge>Stock counted</Badge>}
                        {(p.notice_days ?? settings.notice_days) > 0 && (
                          <Badge tone="pink">Order {p.notice_days ?? settings.notice_days} day(s) ahead</Badge>
                        )}
                        {!p.active && <Badge tone="red">Inactive</Badge>}
                        {missingPrice && <Badge tone="amber">No price yet</Badge>}
                      </div>
                    </div>
                    <ActionForm action={updatePrice} className="flex flex-wrap items-end gap-2" submitLabel="Save">
                      <input type="hidden" name="id" value={p.id} />
                      <Field label={market ? (p.sold_by === "weight" ? "Price per kg (today)" : "Price (today)") : "Price"} className="w-36">
                        <PesoInput name="price" defaultValue={p.price} />
                      </Field>
                      {market && (
                        <Field label={p.sold_by === "weight" ? "Estimate per kg" : "Estimate shown"} className="w-36">
                          <PesoInput name="estimated_price" defaultValue={p.estimated_price} />
                        </Field>
                      )}
                      {!market && <input type="hidden" name="estimated_price" value={p.estimated_price ?? ""} />}
                    </ActionForm>
                    <ActionForm action={setProductActive} className="flex items-end" submitLabel={p.active ? "Hide" : "Show"} danger={p.active}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                    </ActionForm>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      <Card title="Categories" description="Rename, reorder or hide a whole category.">
        <div className="flex flex-col gap-3">
          {categories.map((c) => (
            <ActionForm key={c.id} action={saveCategory} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={c.id} />
              <Field label="Name" className="w-48">
                <Input name="name" defaultValue={c.name} required />
              </Field>
              <Field label="Order" className="w-20">
                <Input name="sort_order" type="number" defaultValue={c.sort_order} />
              </Field>
              <div className="pb-2">
                <Checkbox name="active" label="Shown" defaultChecked={c.active} />
              </div>
            </ActionForm>
          ))}
          <ActionForm action={saveCategory} className="flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3 dark:border-stone-800" submitLabel="Add category">
            <Field label="New category" className="w-48">
              <Input name="name" placeholder="e.g. Drinks" required />
            </Field>
            <Field label="Order" className="w-20">
              <Input name="sort_order" type="number" defaultValue={categories.length + 1} />
            </Field>
            <input type="hidden" name="active" value="on" />
          </ActionForm>
        </div>
      </Card>

    </>
  );
}

