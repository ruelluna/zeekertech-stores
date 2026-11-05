import Link from "next/link";
import { Suspense } from "react";
import { Loading, PageHeader } from "@/components/ui";
import { loadProductForm } from "../product-data";
import { ProductForm } from "../product-form";

export default function NewProductPage() {
  return (
    <>
      <Link href="/admin/menu" className="text-sm text-muted hover:underline hover:decoration-accent">
        ← Menu & prices
      </Link>
      <div className="mt-2" />
      <PageHeader title="Add product" />
      <Suspense fallback={<Loading />}>
        <NewProduct />
      </Suspense>
    </>
  );
}

async function NewProduct() {
  const data = await loadProductForm(null);
  return <ProductForm {...data} />;
}
