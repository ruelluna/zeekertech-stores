import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "../login/actions";

export const metadata = { title: "Admin · Weekend Food Hub" };

const NAV = [
  { href: "/admin/menu", label: "Menu & prices" },
  { href: "/admin/add-ons", label: "Add-ons" },
  { href: "/admin/ingredients", label: "Ingredients" },
  { href: "/admin/delivery", label: "Delivery" },
  { href: "/admin/hours", label: "Hours & settings" },
  { href: "/admin/promotions", label: "Promotions" },
];

// Static chrome only: each page checks the owner session itself, inside a Suspense boundary.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-stone-50 dark:bg-stone-950">
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            WFH Admin
          </Link>
          <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-stone-600 hover:text-orange-700 dark:text-stone-300">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
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
