import Link from "next/link";
import { Suspense } from "react";
import { serviceAreaCenter } from "@wfh/shared";
import { Loading } from "@/components/ui";
import { DAANBANTAYAN_CENTER, fetchCatalog } from "@/lib/catalog";
import { getCurrentCustomer } from "@/lib/customer";
import { welcomeOfferFor } from "@/lib/discounts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckoutForm, type CheckoutData } from "./checkout-form";

export const metadata = { title: "Checkout · Weekend Food Hub" };

export default function CheckoutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">
      <Link href="/" className="text-sm text-stone-500 hover:text-orange-700">
        ← Back to menu
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold tracking-tight">Checkout</h1>
      <Suspense fallback={<Loading />}>
        <Checkout />
      </Suspense>
    </main>
  );
}

async function Checkout() {
  const [catalog, customer] = await Promise.all([fetchCatalog(), getCurrentCustomer()]);
  const offer = await welcomeOfferFor(customer);

  let savedAddresses: CheckoutData["savedAddresses"] = [];
  if (customer) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .schema("store")
      .from("customer_addresses")
      .select("id, label, barangay_id, street_purok, landmark, rider_notes, lat, lng, is_default")
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
    customer: customer ? { name: customer.name, phone: customer.phone } : null,
    facebookLogin: process.env.NEXT_PUBLIC_FACEBOOK_LOGIN === "on",
    offer,
    savedAddresses,
    barangays: catalog.barangays.map((b) => ({ id: b.id, name: b.name, center: b.center })),
    kitchen: catalog.delivery.kitchen,
    mapCenter:
      catalog.delivery.kitchen ??
      (catalog.delivery.serviceArea ? serviceAreaCenter(catalog.delivery.serviceArea) : null) ??
      DAANBANTAYAN_CENTER,
    deliveryReady: catalog.delivery.kitchen !== null,
    hours: catalog.hours,
    closures: catalog.closures,
    settings: {
      orderingPaused: catalog.settings.orderingPaused,
      allowPreorders: catalog.settings.allowPreorders,
      prepLeadMinutes: catalog.settings.prepLeadMinutes,
      deliveryBufferMinutes: catalog.settings.deliveryBufferMinutes,
      uncertainItemsCutoff: catalog.settings.uncertainItemsCutoff,
      pickupInstructions: catalog.settings.pickupInstructions,
      kitchenAddress: catalog.delivery.kitchenAddress,
    },
  };
  return <CheckoutForm data={data} />;
}
