import { cache, Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/catalog/product-purchase";
import { ProductCard } from "@/components/catalog/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogError, getProductBySlug, searchProducts } from "@/lib/catalog/server";

type Params = Promise<{ slug: string }>;

/**
 * generateMetadata and the page both need the product; React's cache folds that into one
 * upstream call per request instead of two.
 */
const loadProduct = cache((slug: string) => getProductBySlug(slug));

async function loadOr404(slug: string) {
  try {
    return await loadProduct(slug);
  } catch (error) {
    if (error instanceof CatalogError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await loadProduct(slug);
    return {
      title: product.title,
      description: product.description?.slice(0, 160),
    };
  } catch {
    return { title: "Product" };
  }
}

function DetailSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
        <Skeleton className="aspect-[4/5] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Under cacheComponents every uncached read needs a boundary, including this route's. */
export default function ProductPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await loadOr404(slug);

  const related = await searchProducts({
    category: product.categorySlug,
    size: 8,
    page: 0,
  }).catch(() => null);

  const others = (related?.content ?? []).filter((entry) => entry.id !== product.id).slice(0, 4);
  const genderSlug = product.gender?.toLowerCase();

  return (
    <div className="space-y-20">
      <nav aria-label="Breadcrumb" className="label-caps text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Shop
        </Link>
        {genderSlug ? (
          <>
            <span aria-hidden> / </span>
            <Link href={`/products?gender=${genderSlug}`} className="hover:text-foreground">
              {product.gender}
            </Link>
          </>
        ) : null}
        {product.categorySlug ? (
          <>
            <span aria-hidden> / </span>
            <Link href={`/products?category=${product.categorySlug}`} className="hover:text-foreground">
              {product.category}
            </Link>
          </>
        ) : null}
      </nav>

      <ProductPurchase product={product} />

      <section aria-labelledby="details-heading" className="max-w-3xl border-t pt-10">
        <h2 id="details-heading" className="label-caps text-muted-foreground">
          Details
        </h2>
        <ul className="mt-4 space-y-2 text-sm leading-6">
          {product.material ? <li>{product.material}</li> : null}
          {product.brand ? <li>{product.brand}</li> : null}
          <li>Made for {product.gender?.toLowerCase() === "women" ? "women" : "men"}.</li>
          {product.careInstructions ? <li>{product.careInstructions}</li> : null}
        </ul>
      </section>

      {others.length ? (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl md:text-2xl">
            More from {product.category}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {others.map((entry) => (
              <ProductCard key={entry.id} product={entry} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
