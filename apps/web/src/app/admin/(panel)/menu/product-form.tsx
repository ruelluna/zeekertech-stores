import { ActionForm } from "@/components/action-form";
import { Card, Checkbox, Field, Input, PesoInput, Select, Textarea, peso } from "@/components/ui";
import type { Tables } from "@wfh/shared";
import { saveProduct } from "./actions";

type Product = Tables<{ schema: "store" }, "products">;

export interface ProductFormData {
  product: Product | null;
  /** The store's default advance notice, used when the product leaves it blank. */
  storeNoticeDays: number;
  categories: { id: string; name: string }[];
  ingredients: { id: string; name: string; availability_mode: string }[];
  groups: { id: string; name: string; modifiers: { id: string; name: string; price_delta: number | null }[] }[];
  linkedIngredientIds: string[];
  linkedGroupIds: string[];
  /** For linked groups: the option that must be picked for the group to show (null = always). */
  showWhen: Record<string, string | null>;
}

const TYPE_LABELS = {
  made_to_order: "Made to order (kitchen)",
  ready_made: "Ready-made (pack only)",
  frozen: "Frozen (as is, or cooked for a fee)",
  bundle: "Bundle",
} as const;

export function ProductForm({ product: p, storeNoticeDays, categories, ingredients, groups, linkedIngredientIds, linkedGroupIds, showWhen }: ProductFormData) {
  return (
    <ActionForm action={saveProduct} submitLabel={p ? "Save product" : "Create product"} className="flex flex-col">
      {p && <input type="hidden" name="id" value={p.id} />}

      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <Input name="name" defaultValue={p?.name ?? ""} required />
          </Field>
          <Field label="SKU" hint="Capital letters, numbers, dashes. Used in orders and labels.">
            <Input name="sku" defaultValue={p?.sku ?? ""} required pattern="[A-Z0-9\-]+" />
          </Field>
          <Field label="Category">
            <Select name="category_id" defaultValue={p?.category_id ?? categories[0]?.id}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue={p?.type ?? "made_to_order"}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea name="description" defaultValue={p?.description ?? ""} />
          </Field>
        </div>
      </Card>

      <Card title="Price" description="Leave the price blank until it's decided; the item shows as “coming soon”.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pricing">
            <Select name="price_mode" defaultValue={p?.price_mode ?? "fixed"}>
              <option value="fixed">Fixed price</option>
              <option value="market">Market price (confirmed before payment)</option>
            </Select>
          </Field>
          <Field label="Sold by">
            <Select name="sold_by" defaultValue={p?.sold_by ?? "unit"}>
              <option value="unit">Piece / serving</option>
              <option value="weight">Weight (per kg)</option>
            </Select>
          </Field>
          <Field label="Weight options (kg)" hint="Only for items sold by weight, e.g. 0.5, 1, 1.5, 2">
            <Input name="weight_options_kg" defaultValue={p?.weight_options_kg.join(", ") ?? ""} />
          </Field>
          <Field label="Price" hint="Fixed price, or today's price per kg for market items">
            <PesoInput name="price" defaultValue={p?.price ?? null} />
          </Field>
          <Field label="Estimated price" hint="Market items only, per kg when sold by weight: shown as “~₱___”">
            <PesoInput name="estimated_price" defaultValue={p?.estimated_price ?? null} />
          </Field>
        </div>
      </Card>

      <Card title="Kitchen & stock">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prep time (minutes)" hint="Sets the same-day order cutoff. For frozen items, applies when cooked.">
            <Input name="prep_minutes" type="number" min="0" defaultValue={p?.prep_minutes ?? ""} />
          </Field>
          <Field label="Order in category">
            <Input name="sort_order" type="number" defaultValue={p?.sort_order ?? 0} />
          </Field>
          <Field label="Advance notice (days)" hint={`Made-to-order items. Blank = the store's notice (${storeNoticeDays === 1 ? "1 day" : `${storeNoticeDays} days`}).`}>
            <Input name="notice_days" type="number" min="0" max="60" defaultValue={p?.notice_days ?? ""} />
          </Field>
          <Field label="Notes label" hint="Replaces “Notes” when adding to cart, e.g. Message on the cake" className="sm:col-span-2">
            <Input name="note_prompt" defaultValue={p?.note_prompt ?? ""} placeholder="Notes" />
          </Field>
          <div className="flex flex-col justify-end gap-2 pb-2">
            <Checkbox name="stock_tracked" label="Count stock (packs)" defaultChecked={p?.stock_tracked ?? false} />
            <Checkbox name="active" label="Active (shown on the menu)" defaultChecked={p?.active ?? true} />
          </div>
        </div>
      </Card>

      <Card
        title="Key ingredients"
        description="If a key ingredient is out today, this item shows as sold out. Uncertain ingredients make it “subject to availability”."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {ingredients.map((i) => (
            <Checkbox
              key={i.id}
              name="ingredient_ids"
              value={i.id}
              label={i.availability_mode === "subject_to_availability" ? `${i.name} (uncertain)` : i.name}
              defaultChecked={linkedIngredientIds.includes(i.id)}
            />
          ))}
        </div>
      </Card>

      <Card
        title="Add-on groups"
        description="Prices for add-ons and cooking fees are set on the Add-ons page. “Show” lets a group appear only after another option is picked, e.g. Egg style only when Add egg is ticked."
      >
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 p-2 dark:border-stone-800">
              <Checkbox
                name="group_ids"
                value={g.id}
                label={`${g.name}: ${g.modifiers.map((m) => `${m.name}${m.price_delta ? ` +${peso(m.price_delta)}` : ""}`).join(", ")}`}
                defaultChecked={linkedGroupIds.includes(g.id)}
              />
              <label className="flex items-center gap-2 text-xs text-stone-500">
                Show
                <select
                  name={`show_when_${g.id}`}
                  defaultValue={showWhen[g.id] ?? ""}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs dark:border-stone-700 dark:bg-stone-950"
                >
                  <option value="">always</option>
                  {groups
                    .filter((other) => other.id !== g.id)
                    .flatMap((other) =>
                      other.modifiers.map((m) => (
                        <option key={m.id} value={m.id}>
                          only with {other.name}: {m.name}
                        </option>
                      )),
                    )}
                </select>
              </label>
            </div>
          ))}
        </div>
      </Card>
    </ActionForm>
  );
}
