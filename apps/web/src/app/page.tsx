import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, peso } from "@/components/ui";
import { getPublicMenu, type MenuItem, type PublicMenu } from "@/lib/menu";
import Link from "next/link";
import { AddToCart } from "./add-to-cart";
import { CartBar } from "./cart-bar";
import { StoreStatusPill } from "./store-status";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Weekend Food Hub</h1>
          <Link href="/account" className="mt-2 shrink-0 text-sm text-stone-600 hover:text-orange-700 dark:text-stone-400">
            My orders
          </Link>
        </div>
        <p className="mt-1 text-stone-600 dark:text-stone-400">Chaofan, silog, paluto and frozen food · Tapilon, Daanbantayan</p>
      </header>
      <Suspense fallback={<p className="text-sm text-stone-500">Loading the menu…</p>}>
        <Menu />
      </Suspense>
    </main>
  );
}

async function Menu() {
  // Read at request time (not at build), then served from the cache.
  await connection();
  const menu = await getPublicMenu();
  const mainCategories = menu.categories.filter((c) => c.brandId === null);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3">
        <StoreStatusPill hours={menu.hours} closures={menu.closures} paused={menu.orderingPaused} />
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-200">
          Pickup in Tapilon, or delivery anywhere in mainland Daanbantayan from {peso(menu.baseDeliveryFee)}.
          {menu.allowPreorders ? " Closed? You can still pre-order for later." : ""}
        </p>
      </div>

      <nav className="sticky top-0 z-10 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-stone-50/95 px-4 py-2 backdrop-blur dark:bg-stone-950/95">
        {mainCategories.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="shrink-0 rounded-full border border-stone-300 px-3 py-1 text-sm hover:border-orange-500 dark:border-stone-700">
            {c.name}
          </a>
        ))}
        {menu.brands.map((b) => (
          <a
            key={b.id}
            href={`#${b.id}`}
            className="shrink-0 rounded-full border border-pink-300 bg-pink-50 px-3 py-1 text-sm text-pink-800 hover:border-pink-500 dark:border-pink-800 dark:bg-pink-950 dark:text-pink-200"
          >
            {b.name}
          </a>
        ))}
      </nav>

      {mainCategories.map((c) => (
        <CategorySection key={c.id} category={c} canOrder={!menu.orderingPaused} />
      ))}

      {menu.brands.map((b) => (
        <section key={b.id} id={b.id} className="mb-10 scroll-mt-16 rounded-2xl border border-pink-200 bg-pink-50/60 p-4 dark:border-pink-900 dark:bg-pink-950/30">
          <header className="mb-5">
            <h2 className="text-2xl font-semibold tracking-tight text-pink-900 dark:text-pink-200">{b.name}</h2>
            {b.tagline && <p className="mt-1 text-stone-600 dark:text-stone-400">{b.tagline}</p>}
            {b.noticeDays > 0 && (
              <p className="mt-2 text-sm text-pink-900 dark:text-pink-200">
                Baked to order. Please order at least {noticeText(b.noticeDays)} before your pickup or delivery date.
              </p>
            )}
          </header>
          {menu.categories
            .filter((c) => c.brandId === b.id)
            .map((c) => (
              <CategorySection key={c.id} category={c} canOrder={!menu.orderingPaused} />
            ))}
        </section>
      ))}

      <footer className="border-t border-stone-200 pt-6 text-sm text-stone-500 dark:border-stone-800">
        <p>🟡 “Subject to availability” dishes use seasonal seafood. We confirm before you pay.</p>
        <p className="mt-2">
          <Link href="/privacy" className="hover:text-orange-700">Privacy</Link> ·{" "}
          <Link href="/terms" className="hover:text-orange-700">Terms</Link> ·{" "}
          <Link href="/data-deletion" className="hover:text-orange-700">Data deletion</Link>
        </p>
      </footer>
      <div className="h-20" />
      <CartBar />
    </>
  );
}

function CategorySection({ category: c, canOrder }: { category: PublicMenu["categories"][number]; canOrder: boolean }) {
  return (
    <section id={c.id} className="mb-10 scroll-mt-16 last:mb-0">
      <h2 className="mb-3 text-xl font-semibold">{c.name}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {c.items.map((item) => (
          <MenuCard key={item.id} item={item} canOrder={canOrder} />
        ))}
      </ul>
    </section>
  );
}

const noticeText = (days: number) => (days === 1 ? "1 day" : `${days} days`);

function MenuCard({ item, canOrder }: { item: MenuItem; canOrder: boolean }) {
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
      <AddToCart item={item} canOrder={canOrder} />
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
