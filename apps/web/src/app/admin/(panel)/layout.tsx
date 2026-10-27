import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { LiveVisitors } from "@/components/presence";
import { ROLE_PAGES, currentStaffRole } from "@/lib/auth";
import { signOut } from "../login/actions";

export const metadata = { title: "Admin · Weekend Food Hub" };

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
  { page: "staff", label: "Staff" },
];

const ROLE_LABEL = { owner: "Owner", verifier: "Payments", kitchen: "Kitchen", counter: "Counter", rider: "Rider" } as const;

// The chrome is static; only the nav (which depends on the signed-in role) waits for the session.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50 dark:bg-stone-950">
      <header className="border-b border-stone-200 bg-white print:hidden dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            WFH Admin
          </Link>
          <Suspense fallback={<nav className="flex-1" />}>
            <RoleNav />
          </Suspense>
          <div className="flex items-center gap-3 text-sm">
            <LiveVisitors />
            <Link href="/" className="text-stone-500 hover:text-orange-700">
              View menu
            </Link>
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

async function RoleNav() {
  const role = await currentStaffRole();
  const pages = role ? ROLE_PAGES[role] : [];
  return (
    <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {NAV.filter((item) => pages.includes(item.page)).map((item) => (
        <Link key={item.page} href={`/admin/${item.page}`} className="text-stone-600 hover:text-orange-700 dark:text-stone-300">
          {item.label}
        </Link>
      ))}
      {role && role !== "owner" && (
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">{ROLE_LABEL[role]}</span>
      )}
    </nav>
  );
}
