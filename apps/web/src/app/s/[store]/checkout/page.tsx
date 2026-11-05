import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { serviceAreaCenter } from "@wfh/shared";
import { Loading } from "@/components/ui";
import { DAANBANTAYAN_CENTER, fetchCatalog } from "@/lib/catalog";
import { getCurrentCustomer } from "@/lib/customer";
import { welcomeOfferFor } from "@/lib/discounts";
import { getPublicMenu } from "@/lib/menu";
import { getStore } from "@/lib/stores";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutForm, type CheckoutData } from "./checkout-form";
import { readServerPublicEnv } from "@/lib/supabase/env";
import { StoreHeader } from "@/components/store-header";
import { StoreTheme } from "@/components/store-theme";

export async function generateMetadata({ params }: PageProps<"/s/[store]/checkout">): Promise<Metadata> {
  const store = await getStore((await params).store);
  return { title: `Checkout · ${store.name}` };
}

export default function CheckoutPage({ params }: PageProps<"/s/[store]/checkout">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
      <Suspense fallback={<Loading />}>
        <Checkout params={params} />
      </Suspense>
    </main>
  );
}

async function Checkout({ params }: { params: PageProps<"/s/[store]/checkout">["params"] }) {
  // Request time only: the build must not reach Supabase (the Docker image is built without its address).
  await connection();
  const store = await getStore((await params).store);
  const [catalog, customer, menu] = await Promise.all([fetchCatalog(store.id), getCurrentCustomer(store.id), getPublicMenu(store.id)]);
  const offer = await welcomeOfferFor(customer, store.id);

  let savedAddresses: CheckoutData["savedAddresses"] = [];
  if (customer) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .schema("store")
      .from("customer_addresses")
      .select("id, label, barangay_id, street_purok, landmark, rider_notes, lat, lng, is_default")
      .eq("customer_id", customer.id)
      .order("is_default", { ascending: false });
    savedAddresses = (data ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      barangayId: a.barangay_id,
      streetPurok: a.street_purok,
      landmark: a.landmark,
      riderNotes: a.rider_notes,
      lat: a.lat,
      lng: a.lng,
    }));
  }

  const data: CheckoutData = {
    store: { id: store.id, slug: store.slug, name: store.name },
    customer: customer ? { name: customer.name, phone: customer.phone } : null,
    facebookLogin: readServerPublicEnv().facebookLogin,
    offer,
    menuItems: Object.fromEntries(menu.categories.flatMap((c) => c.items).map((i) => [i.id, i])),
    savedAddresses,
    barangays: catalog.barangays.map((b) => ({ id: b.id, name: b.name, center: b.center })),
    kitchen: catalog.delivery.kitchen,
    mapCenter:
      catalog.delivery.kitchen ??
      (catalog.delivery.serviceArea ? serviceAreaCenter(catalog.delivery.serviceArea) : null) ??
      DAANBANTAYAN_CENTER,
    deliveryEnabled: catalog.delivery.enabled,
    deliveryReady: catalog.delivery.kitchen !== null,
    hours: catalog.hours,
    closures: catalog.closures,
    settings: {
      orderingPaused: catalog.settings.orderingPaused,
      allowPreorders: catalog.settings.allowPreorders,
      prepLeadMinutes: catalog.settings.prepLeadMinutes,
      deliveryBufferMinutes: catalog.settings.deliveryBufferMinutes,
      uncertainItemsCutoff: catalog.settings.uncertainItemsCutoff,
      slotStartOffsetMinutes: catalog.settings.slotStartOffsetMinutes,
      slotEndOffsetMinutes: catalog.settings.slotEndOffsetMinutes,
      pickupInstructions: catalog.settings.pickupInstructions,
      kitchenAddress: catalog.delivery.kitchenAddress,
    },
  };
  return (
    <StoreTheme accent={store.accent_color}>
      <StoreHeader store={store} size="sm" />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutForm data={data} />
    </StoreTheme>
  );
}
