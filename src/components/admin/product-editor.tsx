"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GalleryManager } from "@/components/admin/gallery-manager";
import { ProductFields } from "@/components/admin/product-fields";
import { VariantManager } from "@/components/admin/variant-manager";
import { useAdminCategories, type AdminCategoryNode } from "@/lib/admin/categories";
import { useAdminProduct, useUpdateProduct, type AdminProduct } from "@/lib/admin/products";
import {
  productDefaults,
  productFormSchema,
  toUpdateBody,
  type ProductFormValues,
} from "@/lib/validation/admin-product";

function EditProduct({
  product,
  categories,
}: {
  product: AdminProduct;
  categories: AdminCategoryNode[];
}) {
  const updateProduct = useUpdateProduct(product.id!);
  const stockApplies = (product.variants?.length ?? 0) <= 1;
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productDefaults(product),
  });

  const submit = form.handleSubmit((values) => {
    updateProduct.mutate(toUpdateBody(values, product, stockApplies), {
      onSuccess: () => {
        form.reset(values);
        toast.success("Product saved");
      },
      onError: (error) => toast.error(error.message),
    });
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="border p-5 sm:p-6">
        <h2 className="label-caps text-muted-foreground">Product details</h2>
        <div className="mt-5">
          <ProductFields form={form} categories={categories} stockEditable={stockApplies} />
        </div>
        <div className="mt-6 flex items-center justify-end gap-3 border-t pt-5">
          {product.slug && product.isActive !== false ? (
            <Link
              href={`/products/${product.slug}`}
              className="mr-auto text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              View in store ↗
            </Link>
          ) : null}
          <Button type="submit" disabled={updateProduct.isPending}>
            {updateProduct.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function EditProductPageWithData({
  product,
  categories,
}: {
  product: AdminProduct;
  categories: AdminCategoryNode[];
}) {
  return (
    <section className="space-y-6">
      <header>
        <Link
          href="/admin/products"
          className="label-caps text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Products
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl tracking-tight">{product.title}</h1>
          <Badge variant={product.isActive === false ? "outline" : "secondary"}>
            {product.isActive === false ? "Draft" : "Live"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {product.category ?? "No category"} · {product.slug}
        </p>
      </header>

      <EditProduct product={product} categories={categories} />

      <div className="border p-5 sm:p-6">
        <h2 className="label-caps text-muted-foreground">Variants</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each size and colour pair carries its own SKU and stock. A piece needs at least one.
        </p>
        <div className="mt-5">
          <VariantManager product={product} />
        </div>
      </div>

      <div className="border p-5 sm:p-6">
        <h2 className="label-caps text-muted-foreground">Gallery</h2>
        <div className="mt-5">
          <GalleryManager product={product} />
        </div>
      </div>
    </section>
  );
}

export function ProductEditor() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const product = useAdminProduct(id);
  const categories = useAdminCategories();

  if (!Number.isFinite(id)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>This product address is not valid</AlertTitle>
        <AlertDescription>
          <Link href="/admin/products" className="underline underline-offset-4">
            Back to products
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (product.isPending || categories.isPending) {
    return (
      <section aria-label="Loading product" className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-64 w-full" />
      </section>
    );
  }

  if (product.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>The product could not be loaded</AlertTitle>
        <AlertDescription>
          {product.error instanceof Error ? product.error.message : "Please try again."}
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void product.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (categories.isError || !product.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Categories could not be loaded</AlertTitle>
        <AlertDescription>
          {categories.error instanceof Error ? categories.error.message : "Please try again."}
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void categories.refetch()}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <EditProductPageWithData
      key={product.data.id}
      product={product.data}
      categories={categories.data ?? []}
    />
  );
}
