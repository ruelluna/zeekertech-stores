import Link from "next/link";
import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { loadProductForm } from "../product-data";
import { ProductForm } from "../product-form";

export default function EditProductPage({ params }: PageProps<"/admin/menu/[id]">) {
  return (
    <>
      <Link href="/admin/menu" className="text-sm text-stone-500 hover:text-orange-700">
        ← Menu & prices
      </Link>
      <Suspense fallback={<Loading />}>
        <EditProduct params={params} />
      </Suspense>
    </>
  );
}

async function EditProduct({ params }: { params: PageProps<"/admin/menu/[id]">["params"] }) {
  const { id } = await params;
  const data = await loadProductForm(id);
  return (
    <>
      <div className="mt-2" />
      <PageHeader title={data.product?.name ?? "Product"} description={data.product?.sku} />
      <ProductForm {...data} />
    </>
  );
}
