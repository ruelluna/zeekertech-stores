import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ContactLink } from "@/components/contact-link";
import { listStores, storePath } from "@/lib/stores";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Shared legal page. The wording covers every store on the site; when the link came from a store's menu
 * (?store=<slug>), the top shows that store's name and contact and links back to its menu.
 */
export function LegalPage({ title, updated, searchParams, children }: { title: string; updated: string; searchParams: SearchParams; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
      <Suspense fallback={<div className="h-5" />}>
        <StoreContext searchParams={searchParams} />
      </Suspense>
      <h1 className="mb-1 mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mb-6 text-sm text-stone-500">Last updated {updated}</p>
      <div className="flex flex-col gap-4 text-sm leading-6 text-stone-700 dark:text-stone-300 [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-stone-900 dark:[&_h2]:text-stone-100 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}

async function StoreContext({ searchParams }: { searchParams: SearchParams }) {
  const slug = (await searchParams).store;
  const store = typeof slug === "string" ? (await listStores()).find((s) => s.slug === slug && s.active) : undefined;
  if (!store) return null;

  return (
    <>
      <Link href={storePath(store.slug)} className="text-sm text-stone-500 hover:text-orange-700">
        ← {store.name}
      </Link>
      <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-700 dark:bg-stone-900 dark:text-stone-300">
        You&apos;re ordering from <strong>{store.name}</strong>.{" "}
        {store.contact ? (
          <>
            Contact them at <ContactLink contact={store.contact} />.
          </>
        ) : (
          "Their contact details are on their menu page."
        )}
      </p>
    </>
  );
}
