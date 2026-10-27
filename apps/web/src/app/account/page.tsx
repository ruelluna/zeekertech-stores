import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Field, Input, Loading, peso } from "@/components/ui";
import { getCurrentCustomer } from "@/lib/customer";
import { welcomeOfferFor } from "@/lib/discounts";
import { STATUS_TEXT } from "@/lib/order-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@wfh/shared";
import { customerSignOut } from "../login/actions";
import { deleteAccount, deleteAddress, setDefaultAddress, updateProfile } from "./actions";
import { GuestOrders } from "./guest-orders";

export const metadata = { title: "My account · Weekend Food Hub" };

export default function AccountPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-stone-500 hover:text-orange-700">
        ← Menu
      </Link>
      <Suspense fallback={<Loading />}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return (
      <>
        <h1 className="mb-6 mt-2 text-2xl font-semibold tracking-tight">My orders</h1>
        <Card title="Orders from this device">
          <GuestOrders />
        </Card>
        <Card title="Log in" description="Save your details and addresses, and see your orders on any device.">
          <Link href="/login?next=/account" className="inline-block rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
            Log in
          </Link>
        </Card>
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const store = supabase.schema("store");
  const [orders, addresses, offer] = await Promise.all([
    store
      .from("web_orders")
      .select("order_code, access_token, status, total, created_at, fulfillment")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(30),
    store.from("customer_addresses").select("id, label, street_purok, landmark, is_default, barangays(name)").order("is_default", { ascending: false }),
    welcomeOfferFor(customer),
  ]);

  return (
    <>
      <div className="mb-6 mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Hi, {customer.name.split(" ")[0]}</h1>
        <form action={customerSignOut}>
          <button type="submit" className="text-sm text-stone-500 hover:text-red-700">
            Log out
          </button>
        </form>
      </div>

      {offer && (
        <p className="mb-6 rounded-xl bg-green-50 p-4 text-sm text-green-900 dark:bg-green-950 dark:text-green-200">
          🎉 {offer.name}: {offer.type === "fixed" ? peso(offer.value) : `${offer.value}%`} off your next order
          {offer.minOrder ? ` of ${peso(offer.minOrder)} or more` : ""}. It&apos;s applied at checkout.
        </p>
      )}

      <Card title="Your orders">
        {(orders.data ?? []).length === 0 ? (
          <p className="text-sm text-stone-500">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {orders.data!.map((o) => (
              <li key={o.order_code} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p>
                    <strong>{o.order_code}</strong> · {peso(o.total)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(o.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" })} ·{" "}
                    {o.fulfillment === "pickup" ? "Pickup" : "Delivery"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{STATUS_TEXT[o.status as OrderStatus].title}</Badge>
                  <Link href={`/o/${o.access_token}`} className="text-orange-700 hover:underline">
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Your details">
        <ActionForm action={updateProfile}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <Input name="name" defaultValue={customer.name} required />
            </Field>
            <Field label="Mobile number" hint="Riders call or text this number">
              <Input name="phone" defaultValue={customer.phone ?? ""} inputMode="tel" placeholder="0917 123 4567" />
            </Field>
          </div>
        </ActionForm>
      </Card>

      <Card title="Saved addresses" description="New addresses are saved from checkout.">
        {(addresses.data ?? []).length === 0 ? (
          <p className="text-sm text-stone-500">No saved addresses yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {addresses.data!.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span>
                  <strong>{a.label}</strong> · {[a.street_purok, a.barangays?.name, a.landmark && `near ${a.landmark}`].filter(Boolean).join(", ")}{" "}
                  {a.is_default && <Badge tone="green">Default</Badge>}
                </span>
                <span className="flex gap-2">
                  {!a.is_default && (
                    <ActionForm action={setDefaultAddress} submitLabel="Make default" className="flex items-center gap-2">
                      <input type="hidden" name="id" value={a.id} />
                    </ActionForm>
                  )}
                  <ActionForm action={deleteAddress} submitLabel="Remove" danger className="flex items-center gap-2">
                    <input type="hidden" name="id" value={a.id} />
                  </ActionForm>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Delete my account" description="Removes your login, profile and saved addresses. Past orders are kept for our business records.">
        <ActionForm action={deleteAccount} submitLabel="Delete my account" danger className="flex flex-wrap items-end gap-3">
          <Field label='Type "DELETE" to confirm' className="w-48">
            <Input name="confirm" autoComplete="off" />
          </Field>
        </ActionForm>
      </Card>
    </>
  );
}
