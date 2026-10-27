import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader, PesoInput } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { saveGroup, saveModifier } from "./actions";

export default function AddOnsPage() {
  return (
    <>
      <PageHeader
        title="Add-ons"
        description="Options customers pick for an item, with their prices. Frozen cooking fees live here too (“Fried” / “Cooked”). Options without a price aren't offered yet."
      />
      <Suspense fallback={<Loading />}>
        <Groups />
      </Suspense>
    </>
  );
}

async function Groups() {
  const { supabase } = await requireOwner();
  const { data: groups, error } = await supabase
    .schema("store")
    .from("modifier_groups")
    .select(
      "id, name, required, min_select, max_select, sort_order, modifiers(id, name, price_delta, requires_cooking, active, sort_order), product_modifier_groups(products(name))",
    )
    .order("name");
  if (error) throw error;

  return (
    <>
      {groups.map((g) => {
        const usedBy = g.product_modifier_groups.map((l) => l.products?.name).filter(Boolean);
        const options = [...g.modifiers].sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={g.id} title={g.name} description={usedBy.length ? `Used by: ${usedBy.join(", ")}` : "Not used by any product yet"}>
            <ActionForm action={saveGroup} className="mb-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={g.id} />
              <Field label="Group name" className="w-44">
                <Input name="name" defaultValue={g.name} required />
              </Field>
              <Field label="Min picks" className="w-24">
                <Input name="min_select" type="number" min="0" defaultValue={g.min_select} />
              </Field>
              <Field label="Max picks" className="w-24">
                <Input name="max_select" type="number" min="1" defaultValue={g.max_select} />
              </Field>
              <div className="pb-2">
                <Checkbox name="required" label="Customer must choose" defaultChecked={g.required} />
              </div>
            </ActionForm>

            <ul className="divide-y divide-stone-100 border-t border-stone-100 dark:divide-stone-800 dark:border-stone-800">
              {options.map((m) => (
                <li key={m.id} className="py-3">
                  <ActionForm action={saveModifier} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="group_id" value={g.id} />
                    <input type="hidden" name="sort_order" value={m.sort_order} />
                    <Field label="Option" className="w-48">
                      <Input name="name" defaultValue={m.name} required />
                    </Field>
                    <Field label={m.requires_cooking ? "Cooking fee" : "Extra price"} className="w-32">
                      <PesoInput name="price_delta" defaultValue={m.price_delta} />
                    </Field>
                    <div className="flex flex-col gap-1 pb-1">
                      <Checkbox name="requires_cooking" label="Sends item to kitchen" defaultChecked={m.requires_cooking} />
                      <Checkbox name="active" label="Active" defaultChecked={m.active} />
                    </div>
                    {m.price_delta === null && <Badge tone="amber">No price yet</Badge>}
                  </ActionForm>
                </li>
              ))}
            </ul>

            <ActionForm action={saveModifier} submitLabel="Add option" className="mt-3 flex flex-wrap items-end gap-3 border-t border-stone-100 pt-3 dark:border-stone-800">
              <input type="hidden" name="group_id" value={g.id} />
              <input type="hidden" name="sort_order" value={options.length + 1} />
              <input type="hidden" name="active" value="on" />
              <Field label="New option" className="w-48">
                <Input name="name" required />
              </Field>
              <Field label="Price" className="w-32">
                <PesoInput name="price_delta" defaultValue={null} />
              </Field>
              <div className="pb-2">
                <Checkbox name="requires_cooking" label="Sends item to kitchen" />
              </div>
            </ActionForm>
          </Card>
        );
      })}

      <Card title="New add-on group" description="Then attach it to products on each product's page.">
        <ActionForm action={saveGroup} submitLabel="Add group" className="flex flex-wrap items-end gap-3">
          <Field label="Group name" className="w-44">
            <Input name="name" placeholder="e.g. Drink size" required />
          </Field>
          <Field label="Min picks" className="w-24">
            <Input name="min_select" type="number" min="0" defaultValue={0} />
          </Field>
          <Field label="Max picks" className="w-24">
            <Input name="max_select" type="number" min="1" defaultValue={1} />
          </Field>
          <div className="pb-2">
            <Checkbox name="required" label="Customer must choose" />
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
