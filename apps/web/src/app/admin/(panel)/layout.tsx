import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LiveVisitors } from "@/components/presence";
import { ROLE_PAGES, currentStaff } from "@/lib/auth";
import { signOut } from "../login/actions";
import { switchStore } from "./store-actions";

export const metadata = { title: "Admin" };

const NAV = [
  { page: "orders", label: "Orders" },
  { page: "inventory", label: "Inventory" },
  { page: "deliveries", label: "Deliveries" },
  { page: "menu", label: "Menu & prices" },
  { page: "add-ons", label: "Add-ons" },
  { page: "ingredients", label: "Ingredients" },
  { page: "delivery", label: "Delivery" },
  { page: "hours", label: "Hours & settings" },
  { page: "promotions", label: "Promotions" },
  { page: "texts", label: "Texts" },
  { page: "staff", label: "Staff" },
  { page: "stores", label: "Stores" },
];

const ROLE_LABEL = { owner: "Owner", verifier: "Payments", kitchen: "Kitchen", counter: "Counter", rider: "Rider" } as const;

// The chrome is static; only the store and nav (which depend on the signed-in person) wait for the session.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50 dark:bg-stone-950">
      <header className="border-b border-stone-200 bg-white print:hidden dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Suspense fallback={<span className="font-semibold">Admin</span>}>
            <StoreNav />
          </Suspense>
          <div className="flex items-center gap-3 text-sm">
            <form action={signOut}>
              <button type="submit" className="text-stone-500 hover:text-red-700">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

async function StoreNav() {
  const staff = await currentStaff();
  if (!staff) return <span className="flex-1 font-semibold">Admin</span>;
  const pages = [...ROLE_PAGES[staff.role], ...(staff.superAdmin ? ["stores"] : [])];
  const others = staff.stores.filter((s) => s.id !== staff.storeId);

  return (
    <>
      {others.length === 0 ? (
        <Link href="/admin" className="font-semibold">
          {staff.store.name}
        </Link>
      ) : (
        // Store switcher for people who work in more than one store.
        <details className="relative">
          <summary className="cursor-pointer list-none font-semibold">
            {staff.store.name} <span className="text-xs font-normal text-stone-500">▾ switch</span>
          </summary>
          <div className="absolute left-0 z-20 mt-2 flex min-w-56 flex-col rounded-lg border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900">
            {others.map((s) => (
              <form key={s.id} action={switchStore}>
                <input type="hidden" name="storeId" value={s.id} />
                <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                  {s.name}
                </button>
              </form>
            ))}
          </div>
        </details>
      )}
      <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {NAV.filter((item) => pages.includes(item.page)).map((item) => (
          <Link key={item.page} href={`/admin/${item.page}`} className="text-stone-600 hover:text-orange-700 dark:text-stone-300">
            {item.label}
          </Link>
        ))}
        {staff.role !== "owner" && (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
            {ROLE_LABEL[staff.role]}
          </span>
        )}
        <Link href={`/s/${staff.store.slug}`} className="text-stone-500 hover:text-orange-700">
          View menu
        </Link>
        <LiveVisitors store={staff.store.slug} />
      </nav>
    </>
  );
}
