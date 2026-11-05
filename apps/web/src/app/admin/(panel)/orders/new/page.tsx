import Link from "next/link";
import { Suspense } from "react";
import { formatManilaTime } from "@wfh/shared";
import { Loading, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { DAANBANTAYAN_CENTER, fetchCatalog } from "@/lib/catalog";
import { getPublicMenu } from "@/lib/menu";
import { ManualOrderForm, type AddOnTarget } from "./manual-order-form";

export default function NewOrderPage({ searchParams }: PageProps<"/admin/orders/new">) {
  return (
    <>
      <Link href="/admin/orders" className="text-sm text-stone-500 hover:text-orange-700">
        ← Orders
      </Link>
      <div className="mt-2" />
      <Suspense fallback={<Loading />}>
        <NewOrder searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewOrder({ searchParams }: { searchParams: PageProps<"/admin/orders/new">["searchParams"] }) {
  const { supabase, storeId } = await requireStaff();
  const { addTo } = await searchParams;

  // "+ Add items" on an order: the new items become a linked add-on order.
  let target: AddOnTarget | null = null;
  if (typeof addTo === "string") {
    const { data } = await supabase
      .schema("ops")
      .from("orders")
      .select("id, queue_code, customer_name, fulfillment, scheduled_for, barangay")
      .eq("id", addTo)
      .eq("store_id", storeId)
      .maybeSingle();
    if (data) {
      target = {
        id: data.id,
        queueCode: data.queue_code,
        customerName: data.customer_name,
        fulfillment: data.fulfillment,
        when: formatManilaTime(new Date(data.scheduled_for)),
        barangay: data.barangay,
      };
    }
  }

  const [menu, catalog] = await Promise.all([getPublicMenu(storeId), fetchCatalog(storeId)]);
  return (
    <>
      <PageHeader
        title={target ? `Add items to ${target.queueCode}` : "New order"}
        description={
          target
            ? "The extra items become a linked add-on order with its own labels and payment. Same customer, address and time; no extra delivery fee."
            : "Walk-in, phone or Messenger orders. Paid orders go straight to the kitchen queue."
        }
      />
      <ManualOrderForm
        storeId={storeId}
        categories={menu.categories}
        barangays={catalog.barangays.map((b) => ({ id: b.id, name: b.name, center: b.center }))}
        kitchen={catalog.delivery.kitchen}
        mapCenter={catalog.delivery.kitchen ?? DAANBANTAYAN_CENTER}
        defaultPrepMinutes={catalog.settings.prepLeadMinutes}
        addTo={target}
      />
    </>
  );
}
