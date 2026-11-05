import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, Loading, PageHeader } from "@/components/ui";
import { uploadProductPhoto } from "../actions";
import { loadProductForm } from "../product-data";
import { ProductForm } from "../product-form";

export default function EditProductPage({ params }: PageProps<"/admin/menu/[id]">) {
  return (
    <>
      <Link href="/admin/menu" className="text-sm text-muted hover:underline hover:decoration-accent">
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
      {data.product && (
        <Card title="Photo" description="Shown on the menu. A square photo works best.">
          <div className="flex flex-wrap items-start gap-6">
            {data.product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.product.image_url} alt={data.product.name} className="size-32 rounded-lg object-cover" />
            ) : (
              <p className="flex size-32 items-center justify-center rounded-lg bg-ink-100 text-sm text-muted dark:bg-ink-800">No photo</p>
            )}
            <div className="flex flex-col gap-3">
              <ActionForm action={uploadProductPhoto} submitLabel="Upload photo">
                <input type="hidden" name="id" value={data.product.id} />
                <input type="file" name="photo" accept="image/*" required className="text-sm" />
              </ActionForm>
              {data.product.image_url && (
                <ActionForm action={uploadProductPhoto} submitLabel="Remove photo" danger>
                  <input type="hidden" name="id" value={data.product.id} />
                  <input type="hidden" name="remove" value="1" />
                </ActionForm>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
