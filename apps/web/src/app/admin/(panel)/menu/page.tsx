import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader, PesoInput, Select } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { saveBrand, saveCategory, updatePrice } from "./actions";

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
  const { supabase } = await requireOwner();
  const store = supabase.schema("store");
  const [{ data: categories, error: catError }, { data: products, error: prodError }, { data: brands, error: brandError }] = await Promise.all([
    store.from("categories").select("id, name, sort_order, active, brand_id").order("sort_order"),
    store
      .from("products")
      .select("id, sku, name, category_id, type, price_mode, sold_by, price, estimated_price, stock_tracked, active, sort_order, notice_days")
      .order("sort_order"),
    store.from("brands").select("id, name, tagline, notice_days, sort_order, active").order("sort_order"),
  ]);
  if (catError || prodError || brandError) throw catError ?? prodError ?? brandError;
  const brandById = new Map(brands.map((b) => [b.id, b]));

  return (
    <>
      {categories.map((category) => {
        const items = products.filter((p) => p.category_id === category.id);
        const brand = category.brand_id ? brandById.get(category.brand_id) : undefined;
        const description = [brand?.name, category.active ? null : "Hidden from the menu"].filter(Boolean).join(" · ");
        return (
          <Card key={category.id} title={category.name} description={description || undefined}>
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
                        {(p.notice_days ?? brand?.notice_days ?? 0) > 0 && (
                          <Badge tone="pink">Order {p.notice_days ?? brand?.notice_days} day(s) ahead</Badge>
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
              <BrandSelect brands={brands} defaultValue={c.brand_id} />
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
            <BrandSelect brands={brands} defaultValue={null} />
            <input type="hidden" name="active" value="on" />
          </ActionForm>
        </div>
      </Card>

      <Card
        title="Sub-brands"
        description="Brands sold through this store, like Sweet Treats by Yang. Their categories get their own section on the menu. Advance notice sets the earliest pickup or delivery date for their items (0 = same day)."
      >
        <div className="flex flex-col gap-3">
          {brands.map((b) => (
            <ActionForm key={b.id} action={saveBrand} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={b.id} />
              <Field label="Name" className="w-56">
                <Input name="name" defaultValue={b.name} required />
              </Field>
              <Field label="Tagline" className="w-64">
                <Input name="tagline" defaultValue={b.tagline ?? ""} />
              </Field>
              <Field label="Notice (days)" className="w-28">
                <Input name="notice_days" type="number" min="0" max="60" defaultValue={b.notice_days} />
              </Field>
              <Field label="Order" className="w-20">
                <Input name="sort_order" type="number" defaultValue={b.sort_order} />
              </Field>
              <div className="pb-2">
                <Checkbox name="active" label="Shown" defaultChecked={b.active} />
              </div>
            </ActionForm>
          ))}
          <ActionForm action={saveBrand} className="flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3 dark:border-stone-800" submitLabel="Add brand">
            <Field label="New brand" className="w-56">
              <Input name="name" placeholder="e.g. Sweet Treats by Yang" required />
            </Field>
            <Field label="Tagline" className="w-64">
              <Input name="tagline" placeholder="e.g. Made-to-order cakes and pastries" />
            </Field>
            <Field label="Notice (days)" className="w-28">
              <Input name="notice_days" type="number" min="0" max="60" defaultValue={0} />
            </Field>
            <Field label="Order" className="w-20">
              <Input name="sort_order" type="number" defaultValue={brands.length + 1} />
            </Field>
            <input type="hidden" name="active" value="on" />
          </ActionForm>
        </div>
      </Card>
    </>
  );
}

function BrandSelect({ brands, defaultValue }: { brands: { id: string; name: string }[]; defaultValue: string | null }) {
  return (
    <Field label="Brand" className="w-56">
      <Select name="brand_id" defaultValue={defaultValue ?? ""}>
        <option value="">Weekend Food Hub (main menu)</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
