import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, Loading, PageHeader, Select } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { saveIngredient } from "./actions";

export default function IngredientsPage() {
  return (
    <>
      <PageHeader
        title="Ingredients"
        description="Mark seafood, seasonal fruit and other items that depend on supply as “subject to availability”: dishes using them wait for staff to confirm before the customer pays. Today's status is set on the staff app's daily board."
      />
      <Suspense fallback={<Loading />}>
        <IngredientList />
      </Suspense>
    </>
  );
}

function IngredientFields({ i }: { i?: { name: string; unit: string | null; availability_mode: string; default_wait_minutes: number | null } }) {
  return (
    <>
      <Field label="Name" className="w-44">
        <Input name="name" defaultValue={i?.name ?? ""} required />
      </Field>
      <Field label="Unit" className="w-20">
        <Input name="unit" defaultValue={i?.unit ?? ""} placeholder="kg" />
      </Field>
      <Field label="Availability" className="w-56">
        <Select name="availability_mode" defaultValue={i?.availability_mode ?? "always"}>
          <option value="always">Always available</option>
          <option value="subject_to_availability">Subject to availability</option>
        </Select>
      </Field>
      <Field label="Wait to confirm (min)" className="w-36" hint="Uncertain items only">
        <Input name="default_wait_minutes" type="number" min="1" defaultValue={i?.default_wait_minutes ?? ""} />
      </Field>
    </>
  );
}

async function IngredientList() {
  const { supabase, storeId } = await requireOwner();
  const { data: ingredients, error } = await supabase
    .schema("store")
    .from("ingredients")
    .select("id, key, name, unit, availability_mode, default_wait_minutes, product_ingredients(products(name))")
    .eq("store_id", storeId)
    .order("availability_mode", { ascending: false })
    .order("name");
  if (error) throw error;

  return (
    <>
      <Card title="All ingredients">
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {ingredients.map((i) => (
            <li key={i.id} className="py-3">
              <ActionForm action={saveIngredient} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={i.id} />
                <IngredientFields i={i} />
              </ActionForm>
              <p className="mt-1 text-xs text-stone-500">
                Used in: {i.product_ingredients.map((l) => l.products?.name).filter(Boolean).join(", ") || "no products"}
              </p>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="New ingredient">
        <ActionForm action={saveIngredient} submitLabel="Add ingredient" className="flex flex-wrap items-end gap-3">
          <IngredientFields />
        </ActionForm>
      </Card>
    </>
  );
}
