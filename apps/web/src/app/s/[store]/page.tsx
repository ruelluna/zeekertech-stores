import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { Badge, peso } from "@/components/ui";
import { getPublicMenu, type MenuItem, type PublicMenu } from "@/lib/menu";
import { getStore, storePath, type Store } from "@/lib/stores";
import { AddToCart } from "../../add-to-cart";
import { CartBar } from "../../cart-bar";
import { StoreStatusPill } from "../../store-status";

export async function generateMetadata({ params }: PageProps<"/s/[store]">): Promise<Metadata> {
  const store = await getStore((await params).store);
  return { title: store.name, description: store.tagline ?? undefined };
}

export default function StoreHome({ params }: PageProps<"/s/[store]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-10">
      <Suspense fallback={<p className="text-sm text-stone-500">Loading the menu…</p>}>
        <Menu params={params} />
      </Suspense>
    </main>
  );
}

async function Menu({ params }: { params: PageProps<"/s/[store]">["params"] }) {
  // Read at request time (not at build), then served from the cache.
  await connection();
  const store = await getStore((await params).store);
  const menu = await getPublicMenu(store.id);
  const hasSeafood = menu.categories.some((c) => c.items.some((i) => i.badge === "subject_to_availability"));

  return (
    <>
      <StoreHeader store={store} />
      <div className="mb-6 flex flex-col gap-3">
        <StoreStatusPill hours={menu.hours} closures={menu.closures} paused={menu.orderingPaused} />
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-200">
          {menu.deliveryEnabled ? `Pickup, or delivery in mainland Daanbantayan from ${peso(menu.baseDeliveryFee)}.` : "Pickup only for now."}
          {menu.noticeDays > 0
            ? ` Made to order: please order at least ${noticeText(menu.noticeDays)} before your pickup${menu.deliveryEnabled ? " or delivery" : ""} date.`
            : menu.allowPreorders
              ? " Closed? You can still pre-order for later."
              : ""}
        </p>
      </div>

      <nav className="sticky top-0 z-10 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-stone-50/95 px-4 py-2 backdrop-blur dark:bg-stone-950/95">
        {menu.categories.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-sm hover:border-orange-500 dark:border-stone-700">
            {c.name}
          </a>
        ))}
      </nav>

      {menu.categories.length === 0 && <p className="mb-10 text-stone-500">The menu is being prepared. Please check back soon.</p>}
      {menu.categories.map((c) => (
        <CategorySection key={c.id} category={c} canOrder={!menu.orderingPaused} store={store.slug} />
      ))}

      <footer className="border-t border-stone-200 pt-6 text-sm text-stone-500 dark:border-stone-800">
        {hasSeafood && <p>🟡 “Subject to availability” dishes use seasonal seafood. We confirm before you pay.</p>}
        <p className="mt-2">
          <Link href="/privacy" className="hover:text-orange-700">Privacy</Link> ·{" "}
          <Link href="/terms" className="hover:text-orange-700">Terms</Link> ·{" "}
          <Link href="/data-deletion" className="hover:text-orange-700">Data deletion</Link>
        </p>
      </footer>
      <div className="h-20" />
      <CartBar store={store.slug} />
    </>
  );
}

function StoreHeader({ store }: { store: Store }) {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{store.name}</h1>
        <Link href={storePath(store.slug, "/account")} className="mt-2 shrink-0 text-sm text-stone-600 hover:text-orange-700 dark:text-stone-400">
          My orders
        </Link>
      </div>
      {store.tagline && <p className="mt-1 text-stone-600 dark:text-stone-400">{store.tagline}</p>}
    </header>
  );
}

function CategorySection({ category: c, canOrder, store }: { category: PublicMenu["categories"][number]; canOrder: boolean; store: string }) {
  return (
    <section id={c.id} className="mb-10 scroll-mt-16">
      <h2 className="mb-3 text-xl font-semibold">{c.name}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {c.items.map((item) => (
          <MenuCard key={item.id} item={item} canOrder={canOrder} store={store} />
        ))}
      </ul>
    </section>
  );
}

const noticeText = (days: number) => (days === 1 ? "1 day" : `${days} days`);

function MenuCard({ item, canOrder, store }: { item: MenuItem; canOrder: boolean; store: string }) {
  const dimmed = item.badge === "sold_out" || item.badge === "unavailable";
  return (
    <li
      className={`flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 ${dimmed ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">{item.name}</h3>
        <PriceTag item={item} />
      </div>
      {item.description && <p className="text-sm text-stone-600 dark:text-stone-400">{item.description}</p>}
      <div className="flex flex-wrap gap-1.5">
        <AvailabilityBadge item={item} />
        {item.type === "frozen" && <Badge>Frozen pack</Badge>}
      </div>
      {item.soldBy === "weight" && item.weightOptionsKg.length > 0 && (
        <p className="text-xs text-stone-500">Sizes: {item.weightOptionsKg.map((kg) => `${kg} kg`).join(" · ")}</p>
      )}
      {item.groups
        .filter((g) => g.options.length > 0)
        .map((g) => (
          <p key={g.id} className="text-xs text-stone-500">
            {g.name}
            {g.showWhenModifierId && ` (with ${item.groups.flatMap((x) => x.options).find((o) => o.id === g.showWhenModifierId)?.name ?? "add-on"})`}
            : {g.options.map((o) => (o.priceDelta > 0 ? `${o.name} +${peso(o.priceDelta)}` : o.name)).join(" · ")}
          </p>
        ))}
      <AddToCart item={item} canOrder={canOrder} store={store} />
    </li>
  );
}

function PriceTag({ item }: { item: MenuItem }) {
  if (item.badge === "unavailable") return <span className="shrink-0 text-sm text-stone-500">Coming soon</span>;
  if (item.priceMode === "market") {
    return (
      <span className="shrink-0 text-right text-sm">
        {(item.price ?? item.estimatedPrice) !== null && (
          <span className="block font-semibold">
            {item.price !== null ? "" : "~"}
            {peso(item.price ?? item.estimatedPrice)}
            {item.soldBy === "weight" ? "/kg" : ""}
          </span>
        )}
        <span className="block text-xs text-stone-500">{item.price !== null ? "today · " : ""}market price</span>
      </span>
    );
  }
  return <span className="shrink-0 font-semibold">{peso(item.price)}</span>;
}

function AvailabilityBadge({ item }: { item: MenuItem }) {
  switch (item.badge) {
    case "available":
      if (item.noticeDays > 0) return <Badge tone="pink">Order {noticeText(item.noticeDays)} ahead</Badge>;
      return <Badge tone="green">Available today</Badge>;
    case "subject_to_availability":
      return (
        <Badge tone="amber">
          Subject to availability{item.confirmWaitMinutes ? ` · confirmed in ~${item.confirmWaitMinutes} min` : ""}
        </Badge>
      );
    case "sold_out":
      return <Badge tone="red">Sold out today</Badge>;
    case "unavailable":
      return null;
  }
}
