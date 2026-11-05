import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import Link from "next/link";
import { addDays, manilaInstant, manilaParts, nextServiceDay, openDaysLabel, remainingOn, type BookedQty } from "@wfh/shared";
import { ContactLink } from "@/components/contact-link";
import { StoreHeader } from "@/components/store-header";
import { StoreTheme } from "@/components/store-theme";
import { Badge, peso } from "@/components/ui";
import { fetchBookedQty } from "@/lib/daily-limits";
import { getPublicMenu, type MenuItem, type PublicMenu } from "@/lib/menu";
import { getStore, storePath } from "@/lib/stores";
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
      <Suspense fallback={<p className="text-sm text-muted">Loading the menu…</p>}>
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
  const hasUncertain = menu.categories.some((c) => c.items.some((i) => i.badge === "subject_to_availability"));
  const legal = (path: string) => `${path}?store=${store.slug}`;
  // Badges and the note follow the opening hours: "today" only when the store hands out orders today.
  const now = new Date();
  const service = nextServiceDay({ now, hours: menu.hours, closures: menu.closures });
  // Booked counts, only fetched when a product has a daily limit.
  const booked = menu.categories.some((c) => c.items.some((i) => i.dailyLimit)) ? await fetchBookedQty(store.id) : {};
  const openDays = openDaysLabel(menu.hours);
  const handoff = menu.deliveryEnabled ? "pickup or delivery" : "pickup";

  return (
    <StoreTheme accent={store.accent_color}>
      <StoreHeader
        store={store}
        aside={
          <Link href={storePath(store.slug, "/account")} className="inline-flex min-h-11 shrink-0 items-center text-sm text-ink-600 hover:underline hover:decoration-accent dark:text-ink-300">
            My orders
          </Link>
        }
      />
      <div className="mb-6 flex flex-col gap-3">
        <StoreStatusPill hours={menu.hours} closures={menu.closures} paused={menu.orderingPaused} />
        <p className="rounded-lg bg-kraft-soft p-3 text-sm text-foreground">
          {menu.deliveryEnabled
            ? `Pickup, or delivery${menu.deliveryArea ? ` in ${menu.deliveryArea}` : ""} from ${peso(menu.baseDeliveryFee)}.`
            : "Pickup only for now."}
          {menu.noticeDays > 0
            ? ` Made to order: please order at least ${noticeText(menu.noticeDays)} before your pickup${menu.deliveryEnabled ? " or delivery" : ""} date.`
            : openDays && openDays !== "every day"
              ? ` Open ${openDays}.${menu.allowPreorders ? ` Order anytime for ${handoff} on those days.` : ""}`
              : menu.allowPreorders
                ? " Closed? You can still pre-order for later."
                : ""}
        </p>
      </div>

      <nav className="sticky top-0 z-10 -mx-4 mb-6 flex gap-2 overflow-x-auto bg-background px-4 py-1">
        {menu.categories.map((c) => (
          <a key={c.id} href={`#${c.id}`} className="stamp inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink-300 px-4 text-xs hover:border-accent hover:bg-accent-soft dark:border-ink-700">
            {c.name}
          </a>
        ))}
      </nav>

      {menu.categories.length === 0 && <p className="mb-10 text-muted">The menu is being prepared. Please check back soon.</p>}
      {menu.categories.map((c) => (
        <CategorySection key={c.id} category={c} canOrder={!menu.orderingPaused} store={store.slug} when={{ service, preorders: menu.allowPreorders, now, hours: menu.hours, closures: menu.closures, booked }} />
      ))}

      <footer className="border-t border-ink-200 pt-6 text-sm text-muted dark:border-ink-800">
        {hasUncertain && <p>“Subject to availability” items depend on what we can get that day. We confirm before you pay.</p>}
        {store.contact && (
          <p className="mt-2">
            Questions? Contact {store.name}: <ContactLink contact={store.contact} />
          </p>
        )}
        <p className="mt-2">
          <Link href={legal("/privacy")} className="inline-block py-2.5 hover:underline hover:decoration-accent">Privacy</Link> ·{" "}
          <Link href={legal("/terms")} className="inline-block py-2.5 hover:underline hover:decoration-accent">Terms</Link> ·{" "}
          <Link href={legal("/data-deletion")} className="inline-block py-2.5 hover:underline hover:decoration-accent">Data deletion</Link>
        </p>
      </footer>
      <div className="h-20" />
      <CartBar store={store.slug} />
    </StoreTheme>
  );
}

/** When an orderable item can be handed out: today, or the store's next open day. */
type ServiceWhen = {
  service: ReturnType<typeof nextServiceDay>;
  preorders: boolean;
  now: Date;
  hours: PublicMenu["hours"];
  closures: string[];
  booked: BookedQty;
};

function CategorySection({ category: c, canOrder, store, when }: { category: PublicMenu["categories"][number]; canOrder: boolean; store: string; when: ServiceWhen }) {
  return (
    <section id={c.id} className="mb-10 scroll-mt-16">
      <h2 className="stamp mb-3 text-lg font-bold">{c.name}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {c.items.map((item) => (
          <MenuCard key={item.id} item={item} canOrder={canOrder} store={store} when={when} />
        ))}
      </ul>
    </section>
  );
}

const noticeText = (days: number) => (days === 1 ? "1 day" : `${days} days`);

function MenuCard({ item, canOrder, store, when }: { item: MenuItem; canOrder: boolean; store: string; when: ServiceWhen }) {
  const dimmed = item.badge === "sold_out" || item.badge === "unavailable";
  const limit = limitDays(item, when);
  return (
    <li className={`ticket-card p-4 ${item.imageUrl ? "ticket-card-photo" : ""} ${dimmed ? "opacity-60" : ""}`}>
      {item.imageUrl && (
        // Decorative: the product's name is the heading right above it. Loads only when scrolled to, for mobile data.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="ticket-photo" />
      )}
      {/* Positioned so it paints above the photo, with no z-index so the add-to-cart dialog can still cover the page. */}
      <div className="relative flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium">{item.name}</h3>
          <PriceTag item={item} />
        </div>
        {item.description && <p className="text-sm text-muted">{item.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          {limit?.left === 0 && <LimitBadge limit={limit} />}
          <AvailabilityBadge item={item} when={when} limit={limit} />
          {limit && limit.left > 0 && <LimitBadge limit={limit} />}
          {item.type === "frozen" && <Badge>Frozen pack</Badge>}
        </div>
        {item.soldBy === "weight" && item.weightOptionsKg.length > 0 && (
          <p className="text-xs text-muted">Sizes: {item.weightOptionsKg.map((kg) => `${kg} kg`).join(" · ")}</p>
        )}
        {item.groups
          .filter((g) => g.options.length > 0)
          .map((g) => (
            <p key={g.id} className="text-xs text-muted">
              {g.name}
              {g.showWhenModifierId && ` (with ${item.groups.flatMap((x) => x.options).find((o) => o.id === g.showWhenModifierId)?.name ?? "add-on"})`}
              : {g.options.map((o) => (o.priceDelta > 0 ? `${o.name} +${peso(o.priceDelta)}` : o.name)).join(" · ")}
            </p>
          ))}
        <AddToCart item={item} canOrder={canOrder} store={store} />
      </div>
    </li>
  );
}

function PriceTag({ item }: { item: MenuItem }) {
  if (item.badge === "unavailable") return <span className="shrink-0 text-sm text-muted">Coming soon</span>;
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
        <span className="block text-xs text-muted">{item.price !== null ? "today · " : ""}market price</span>
      </span>
    );
  }
  return <span className="shrink-0 font-semibold">{peso(item.price)}</span>;
}

type LimitDays = {
  /** Earliest pickup/delivery day for this product (after any advance notice). */
  earliest: NonNullable<ReturnType<typeof nextServiceDay>>;
  /** How many are left that day. */
  left: number;
  /** First day that still has room, if the earliest is full. */
  room: ReturnType<typeof nextServiceDay>;
  label: string;
};

/** For a product with a daily limit: its earliest day, what's left then, and the first day with room. */
function limitDays(item: MenuItem, when: ServiceWhen): LimitDays | null {
  if (!item.dailyLimit || (item.badge !== "available" && item.badge !== "subject_to_availability")) return null;
  const today = manilaParts(when.now).dateKey;
  const next = (from: Date) => nextServiceDay({ now: from, hours: when.hours, closures: when.closures });
  const earliest = next(item.noticeDays > 0 ? manilaInstant(addDays(today, item.noticeDays), 0) : when.now);
  if (!earliest) return null;
  const leftOn = (dateKey: string) => remainingOn(item.dailyLimit, when.booked, item.sku, dateKey)!;
  const left = leftOn(earliest.dateKey);
  let room: ReturnType<typeof nextServiceDay> = left > 0 ? earliest : null;
  for (let day = earliest, i = 0; !room && i < 14; i++) {
    const following = next(manilaInstant(addDays(day.dateKey, 1), 0));
    if (!following) break;
    if (leftOn(following.dateKey) > 0) room = following;
    day = following;
  }
  return { earliest, left, room, label: earliest.dateKey === today ? "today" : earliest.weekday };
}

/** "Only 3 left for Sat" when 5 or fewer remain on the earliest day, "Full for today" when none do. */
function LimitBadge({ limit }: { limit: LimitDays | null }) {
  if (!limit) return null;
  if (limit.left === 0) return <Badge tone="amber">Full for {limit.label}</Badge>;
  if (limit.left <= 5) return <Badge tone="amber">Only {limit.left} left for {limit.label}</Badge>;
  return null;
}

function AvailabilityBadge({ item, when, limit }: { item: MenuItem; when: ServiceWhen; limit: LimitDays | null }) {
  switch (item.badge) {
    case "available":
      if (item.noticeDays > 0) return <Badge tone="accent">Order {noticeText(item.noticeDays)} ahead</Badge>;
      // Full on its earliest day: point at the first day with room (the "Full for …" badge says why).
      if (limit && limit.left === 0) {
        if (!limit.room) return null;
        return when.preorders ? <Badge tone="green">Order now for {limit.room.weekday}</Badge> : <Badge>Available {limit.room.weekday}</Badge>;
      }
      if (!when.service) return <Badge>Not taking orders</Badge>;
      if (when.service.isToday) return <Badge tone="green">Available today</Badge>;
      // Closed today: say when it can be picked up or delivered, never "today".
      return when.preorders ? <Badge tone="green">Order now for {when.service.weekday}</Badge> : <Badge>Available {when.service.weekday}</Badge>;
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
