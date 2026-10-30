import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductEditor } from "@/components/admin/product-editor";

export const metadata: Metadata = {
  title: "Edit product",
};

// The editor reads :id from the URL and fetches on the client, so the route cannot offer an
// instant shell; blocking is also what lets the metadata resolve with params.
export const instant = false;

export default function EditProductPage() {
  return (
    <Suspense
      fallback={
        <section aria-label="Loading product" className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </section>
      }
    >
      <ProductEditor />
    </Suspense>
  );
}
