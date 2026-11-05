import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Checkbox, Field, Input, Loading, PageHeader, Select, peso } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addStaff, markRiderPaidOut, resetStaffPassword, updateStaff } from "./actions";

export default function StaffPage() {
  return (
    <>
      <PageHeader title="Staff" description="Logins for your team. Each person signs in at /admin with their own email and password." />
      <Suspense fallback={<Loading />}>
        <Staff />
      </Suspense>
    </>
  );
}

const ROLES = [
  { value: "kitchen", label: "Kitchen", description: "Orders (seafood check, cooking, dispatch, printing, walk-in orders, cash) and inventory." },
  { value: "verifier", label: "Payments", description: "Everything Kitchen does, plus confirming GCash payments and cancelling orders." },
  { value: "counter", label: "Counter", description: "Everything Kitchen does, plus cancelling orders. Can't confirm GCash payments." },
  { value: "rider", label: "Rider", description: "Only their own deliveries: address, map, customer number, amount to collect, Delivered, and their earnings." },
  { value: "owner", label: "Owner", description: "Everything, including menu, prices, delivery, hours, promotions, staff and rider payouts." },
] as const;

function RoleSelect({ value }: { value?: string }) {
  return (
    <Select name="role" defaultValue={value ?? "kitchen"}>
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </Select>
  );
}

async function Staff() {
  const { supabase, userId: me, storeId } = await requireOwner();
  const [{ data: staff, error }, { data: users }] = await Promise.all([
    supabase.schema("ops").from("staff_users").select("user_id, display_name, role, active, created_at").eq("store_id", storeId).order("created_at"),
    createSupabaseAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (error) throw error;
  const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  // Rider pay not yet handed over, per rider account.
  const riders = staff.filter((s) => s.role === "rider");
  const { data: unpaidTrips } = riders.length
    ? await supabase
        .schema("ops")
        .from("orders")
        .select("rider_id, rider_pay, completed_at")
        .eq("store_id", storeId)
        .in("rider_id", riders.map((r) => r.user_id))
        .eq("status", "delivered")
        .is("rider_paid_out_at", null)
    : { data: [] };
  const owed = (riderId: string) => {
    const trips = (unpaidTrips ?? []).filter((t) => t.rider_id === riderId);
    return { count: trips.length, total: trips.reduce((s, t) => s + Number(t.rider_pay ?? 0), 0) };
  };

  return (
    <>
      <Card title="What each role can do">
        <ul className="flex flex-col gap-1 text-sm">
          {ROLES.map((r) => (
            <li key={r.value}>
              <strong>{r.label}:</strong> {r.description}
            </li>
          ))}
        </ul>
      </Card>

      {riders.length > 0 && (
        <Card title="Rider pay" description="Earnings from delivered trips that haven’t been handed over yet. Mark paid out once you’ve paid the rider.">
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {riders.map((r) => {
              const o = owed(r.user_id);
              return (
                <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <strong>{r.display_name}</strong>{" "}
                    <span className="text-stone-500">
                      · {o.count} deliver{o.count === 1 ? "y" : "ies"} unpaid
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <strong className="text-base">{peso(o.total)}</strong>
                    {o.count > 0 && (
                      <ActionForm action={markRiderPaidOut} submitLabel="Mark paid out" className="flex items-center gap-2">
                        <input type="hidden" name="riderId" value={r.user_id} />
                      </ActionForm>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title={`Team (${staff.length})`}>
        <div className="flex flex-col gap-3">
          {staff.map((s) => (
            <details key={s.user_id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-700">
              <summary className="cursor-pointer text-sm">
                <strong>{s.display_name}</strong> <span className="text-stone-500">· {emails.get(s.user_id)}</span>{" "}
                <Badge tone={s.role === "owner" ? "orange" : "neutral"}>{ROLES.find((r) => r.value === s.role)?.label ?? s.role}</Badge>{" "}
                {!s.active && <Badge tone="red">Disabled</Badge>}
                {s.user_id === me && <Badge tone="green">You</Badge>}
              </summary>
              <div className="mt-3 flex flex-col gap-4">
                <ActionForm action={updateStaff} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="userId" value={s.user_id} />
                  <Field label="Name" className="w-48">
                    <Input name="displayName" defaultValue={s.display_name} required />
                  </Field>
                  <Field label="Role" className="w-40">
                    <RoleSelect value={s.role} />
                  </Field>
                  <div className="pb-2">
                    <Checkbox name="active" label="Can sign in" defaultChecked={s.active} />
                  </div>
                </ActionForm>
                <ActionForm action={resetStaffPassword} submitLabel="Change password" className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="userId" value={s.user_id} />
                  <Field label="New password" className="w-56" hint="At least 8 characters. Tell them in person.">
                    <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
                  </Field>
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Card title="Add a staff member" description="They sign in at /admin. Share the password in person and ask them to keep it private.">
        <ActionForm action={addStaff} submitLabel="Add staff member" className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input name="displayName" required placeholder="e.g. Maria (kitchen)" />
            </Field>
            <Field label="Email (used to sign in)">
              <Input name="email" type="email" required autoComplete="off" />
            </Field>
            <Field label="Password" hint="At least 8 characters">
              <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label="Role">
              <RoleSelect />
            </Field>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
