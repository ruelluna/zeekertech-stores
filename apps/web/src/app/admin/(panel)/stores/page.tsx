import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addStoreOwner, createStore, setStoreActive } from "./actions";

export default function StoresPage() {
  return (
    <>
      <PageHeader
        title="Stores"
        description="Each store has its own menu, hours, delivery, GCash, orders, customers and staff, at its own web address. Only super admins see this page."
      />
      <Suspense fallback={<Loading />}>
        <Stores />
      </Suspense>
    </>
  );
}

async function Stores() {
  await requireSuperAdmin();
  // Owners of every store, with their emails (staff rows and logins are read server-side).
  const admin = createSupabaseAdminClient();
  const [{ data: stores, error }, { data: owners }, { data: users }] = await Promise.all([
    admin.schema("store").from("stores").select("id, slug, name, tagline, active").order("sort_order"),
    admin.schema("ops").from("staff_users").select("store_id, user_id, display_name, active").eq("role", "owner"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw error;
  const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  return (
    <>
      {stores.map((s) => {
        const storeOwners = (owners ?? []).filter((o) => o.store_id === s.id);
        return (
          <Card key={s.id} title={s.name} description={s.tagline ?? undefined}>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/s/${s.slug}`} className="text-orange-700 underline">
                  /s/{s.slug}
                </Link>
                {s.active ? <Badge tone="green">Live</Badge> : <Badge tone="red">Hidden</Badge>}
              </span>
              <ActionForm action={setStoreActive} submitLabel={s.active ? "Hide store" : "Make live"} danger={s.active} className="flex items-center">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="active" value={s.active ? "false" : "true"} />
              </ActionForm>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Owners</p>
              {storeOwners.length === 0 ? (
                <p className="text-sm text-stone-500">No owner yet. Super admins can manage it meanwhile.</p>
              ) : (
                <ul className="text-sm">
                  {storeOwners.map((o) => (
                    <li key={o.user_id}>
                      <strong>{o.display_name}</strong> <span className="text-stone-500">· {emails.get(o.user_id)}</span>
                      {!o.active && (
                        <>
                          {" "}
                          <Badge tone="red">Disabled</Badge>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-orange-700">Invite an owner</summary>
              <p className="mt-2 text-xs text-stone-500">They get an email with a link to set their own password, then sign in at /admin and see only this store.</p>
              <ActionForm action={addStoreOwner} submitLabel="Send invite" className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="storeId" value={s.id} />
                <Field label="Name" className="w-44">
                  <Input name="displayName" required />
                </Field>
                <Field label="Email" className="w-64">
                  <Input name="email" type="email" required />
                </Field>
              </ActionForm>
            </details>
          </Card>
        );
      })}

      <Card
        title="New store"
        description="Starts open 8:00 AM – 8:00 PM every day, pickup only, texts off. The owner can change everything in Hours & settings and Delivery."
      >
        <ActionForm action={createStore} submitLabel="Create store" className="flex flex-wrap items-end gap-3">
          <Field label="Store name" className="w-56">
            <Input name="name" placeholder="e.g. Sweet Treats by Yang" required />
          </Field>
          <Field label="Web address" hint="/s/ followed by this" className="w-44">
            <Input name="slug" placeholder="e.g. treatsbyyang" pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
          </Field>
          <Field label="Tagline" className="w-64">
            <Input name="tagline" placeholder="e.g. Made-to-order cakes and pastries" />
          </Field>
          <Field label="Advance notice (days)" hint="0 = same day" className="w-36">
            <Input name="notice_days" type="number" min="0" max="60" defaultValue={0} />
          </Field>
          <Field label="Contact for customers" hint="Facebook Page link or mobile number" className="w-64">
            <Input name="contact" placeholder="e.g. facebook.com/yourstore" maxLength={200} />
          </Field>
          <div className="w-full">
            <Checkbox
              name="copy_area"
              label="Same delivery area as Weekend Food Hub (mainland Daanbantayan barangays and map). Leave unticked for a store elsewhere."
            />
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
