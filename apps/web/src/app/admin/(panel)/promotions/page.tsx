import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader, PesoInput, Select } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import type { Tables } from "@wfh/shared";
import { savePromotion } from "./actions";

type Promotion = Tables<{ schema: "store" }, "promotions">;

export default function PromotionsPage() {
  return (
    <>
      <PageHeader
        title="Promotions"
        description="The welcome discount applies automatically to a customer's first order after logging in with Facebook."
      />
      <Suspense fallback={<Loading />}>
        <PromotionList />
      </Suspense>
    </>
  );
}

function PromotionFields({ p }: { p?: Promotion }) {
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <Field label="Name" className="sm:col-span-2">
        <Input name="name" defaultValue={p?.name ?? ""} required />
      </Field>
      <Field label="When it applies">
        <Select name="trigger" defaultValue={p?.trigger ?? "code"}>
          <option value="welcome">Welcome (first order after login)</option>
          <option value="code">Promo code</option>
          <option value="auto">Automatic for everyone</option>
        </Select>
      </Field>
      <Field label="Code" hint="Promo codes only">
        <Input name="code" defaultValue={p?.code ?? ""} className="uppercase" />
      </Field>
      <Field label="Discount type">
        <Select name="type" defaultValue={p?.type ?? "fixed"}>
          <option value="fixed">Fixed amount (₱)</option>
          <option value="percent">Percent (%)</option>
        </Select>
      </Field>
      <Field label="Amount" hint="₱ or %">
        <Input name="value" type="number" step="0.01" min="0" defaultValue={p?.value ?? ""} required />
      </Field>
      <Field label="Max discount" hint="Caps percent discounts">
        <PesoInput name="max_discount" defaultValue={p?.max_discount ?? null} />
      </Field>
      <Field label="Minimum order">
        <PesoInput name="min_order" defaultValue={p?.min_order ?? null} />
      </Field>
      <Field label="Uses per customer">
        <Input name="per_customer_limit" type="number" min="1" defaultValue={p?.per_customer_limit ?? 1} />
      </Field>
      <Field label="Valid for (days)" hint="Welcome: days after registering">
        <Input name="valid_days" type="number" min="1" defaultValue={p?.valid_days ?? ""} />
      </Field>
      <div className="flex items-end pb-2">
        <Checkbox name="active" label="Active" defaultChecked={p?.active ?? false} />
      </div>
    </div>
  );
}

async function PromotionList() {
  const { supabase, storeId } = await requireOwner();
  const { data: promotions, error } = await supabase.schema("store").from("promotions").select("*").eq("store_id", storeId).order("created_at");
  if (error) throw error;

  return (
    <>
      {promotions.map((p) => (
        <Card key={p.id} title={p.name}>
          <div className="-mt-2 mb-3">{p.active ? <Badge tone="green">Active</Badge> : <Badge>Off</Badge>}</div>
          <ActionForm action={savePromotion}>
            <input type="hidden" name="id" value={p.id} />
            <PromotionFields p={p} />
          </ActionForm>
        </Card>
      ))}
      <Card title="New promotion">
        <ActionForm action={savePromotion} submitLabel="Add promotion">
          <PromotionFields />
        </ActionForm>
      </Card>
    </>
  );
}
