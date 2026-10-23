"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ImagePicker } from "@/components/admin/image-picker";
import { ProductFields } from "@/components/admin/product-fields";
import {
  VariantBuilder,
  buildVariants,
  emptyBuilder,
  type VariantBuilderState,
} from "@/components/admin/variant-builder";
import { useAdminCategories } from "@/lib/admin/categories";
import { useCreateProduct } from "@/lib/admin/products";
import {
  productDefaults,
  productFormSchema,
  toCreateBody,
  type ProductFormValues,
} from "@/lib/validation/admin-product";

export default function NewProductPage() {
  const router = useRouter();
  const categories = useAdminCategories();
  const createProduct = useCreateProduct();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: productDefaults(),
  });
  const title = useWatch({ control: form.control, name: "title" });
  const [builder, setBuilder] = useState<VariantBuilderState>(() => emptyBuilder());
  const [builderErrors, setBuilderErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const willHaveVariants =
    builder.sizes.length > 0 && builder.colors.some((color) => color.name.trim() !== "");

  const submit = form.handleSubmit((values) => {
    const built = buildVariants(values.title, builder);
    setBuilderErrors(built.errors);
    if (built.errors.length > 0) {
      toast.error("Check the variant grid before saving.");
      return;
    }
    setSubmitError(null);
    createProduct.mutate(
      { body: toCreateBody(values, built.variants), files },
      {
        onSuccess: ({ product, failedImages }) => {
          toast.success(`${product.title ?? "Product"} created`);
          if (failedImages.length > 0) {
            toast.warning(
              `Could not upload ${failedImages.join(", ")}. Add the images from the gallery.`,
            );
          }
          router.replace(`/admin/products/${product.id}`);
        },
        onError: (error) => setSubmitError(error.message),
      },
    );
  });

  return (
    <section className="space-y-6">
      <header>
        <Link
          href="/admin/products"
          className="label-caps text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Products
        </Link>
        <h1 className="mt-2 font-heading text-3xl tracking-tight">New product</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the piece, its size and colour grid, and its photographs in one go.
        </p>
      </header>

      {categories.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : categories.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Categories could not be loaded</AlertTitle>
          <AlertDescription>
            {categories.error instanceof Error ? categories.error.message : "Please try again."}
          </AlertDescription>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void categories.refetch()}>
            Retry
          </Button>
        </Alert>
      ) : (
        <form onSubmit={submit} className="space-y-6" noValidate>
          <div className="border p-5 sm:p-6">
            <h2 className="label-caps text-muted-foreground">Product details</h2>
            <div className="mt-5">
              <ProductFields
                form={form}
                categories={categories.data ?? []}
                stockEditable={!willHaveVariants}
              />
            </div>
          </div>

          <div className="border p-5 sm:p-6">
            <h2 className="label-caps text-muted-foreground">Variants</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional. Each combination gets its own SKU and stock; leave them out for a one-size
              piece.
            </p>
            <div className="mt-5">
              <VariantBuilder
                title={title}
                state={builder}
                onChange={setBuilder}
                errors={builderErrors}
              />
            </div>
          </div>

          <div className="border p-5 sm:p-6">
            <h2 className="label-caps text-muted-foreground">Images</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional. Uploaded right after the product is created.
            </p>
            <div className="mt-5">
              <ImagePicker files={files} onChange={setFiles} />
            </div>
          </div>

          {submitError ? (
            <p role="alert" className="border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t pt-5">
            <Link
              href="/admin/products"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={createProduct.isPending}>
              {createProduct.isPending ? "Creating…" : "Create product"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
