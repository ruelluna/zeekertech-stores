import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-stone-500 hover:text-orange-700">
        ← Menu
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mb-6 text-sm text-stone-500">Last updated {updated}</p>
      <div className="flex flex-col gap-4 text-sm leading-6 text-stone-700 dark:text-stone-300 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-stone-900 dark:[&_h2]:text-stone-100 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
