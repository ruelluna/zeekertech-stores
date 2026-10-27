import Link from "next/link";
import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { DAANBANTAYAN_CENTER, fetchCatalog } from "@/lib/catalog";
import { getPublicMenu } from "@/lib/menu";
import { ManualOrderForm } from "./manual-order-form";

export default function NewOrderPage() {
  return (
    <>
      <Link href="/admin/orders" className="text-sm text-stone-500 hover:text-orange-700">
        ← Orders
      </Link>
      <div className="mt-2" />
      <PageHeader title="New order" description="Walk-in, phone or Messenger orders. Paid orders go straight to the kitchen queue." />
      <Suspense fallback={<Loading />}>
        <NewOrder />
      </Suspense>
    </>
  );
}

async function NewOrder() {
  await requireStaff();
  const [menu, catalog] = await Promise.all([getPublicMenu(), fetchCatalog()]);
  return (
    <ManualOrderForm
      categories={menu.categories}
      barangays={catalog.barangays.map((b) => ({ id: b.id, name: b.name, center: b.center }))}
      kitchen={catalog.delivery.kitchen}
      mapCenter={catalog.delivery.kitchen ?? DAANBANTAYAN_CENTER}
      defaultPrepMinutes={catalog.settings.prepLeadMinutes}
    />
  );
}
