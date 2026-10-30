import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/catalog/product-card";
import { FacetPanel } from "@/components/catalog/facet-panel";
import { FacetDisclosure } from "@/components/catalog/facet-disclosure";
import { Pagination } from "@/components/catalog/pagination";
import { EmptyState } from "@/components/empty-state";
import { parseCatalogQuery, toUrlSearchParams } from "@/lib/catalog/query-state";
import { SITE_LOCALE, SITE_NAME } from "@/lib/site";
import {
  getCategoryTree,
  getFacetColors,
  getFacetSizes,
  searchProducts,
  toFacetRoots,
  type CatalogQuery,
} from "@/lib/catalog/server";

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

function descriptionFor(query: CatalogQuery): string {
  if (query.keyword) return `Pieces matching “${query.keyword}” at Nexus Commerce.`;
  if (query.category) return `The ${query.category} collection in natural fibres, made to be worn for years.`;
  if (query.gender === "men") return "Menswear staples in natural fibres — cut to last, not to trend.";
  if (query.gender === "women") return "Womenswear staples in natural fibres — cut to last, not to trend.";
  return "Browse the full Nexus Commerce catalogue by department, size, colour and price.";
}

/**
 * Filtered and sorted URLs are useful to shoppers but explosive for crawlers: every
 * size × colour × price × sort combination is a near-duplicate of the department page.
 * Only department/category/pagination pages are offered for indexing; the rest are
 * crawlable (follow) so link equity still flows to the products themselves.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}): Promise<Metadata> {
  const query = parseCatalogQuery(toUrlSearchParams(await searchParams));
  const facetNoise = Boolean(
    query.sizes?.length || query.colors?.length || query.minPrice || query.maxPrice || query.sort,
  );
  const canonical = new URLSearchParams();
  if (query.gender) canonical.set("gender", query.gender);
  if (query.category) canonical.set("category", query.category);
  if (query.page > 0) canonical.set("page", String(query.page));
  const suffix = canonical.toString();
  const path = suffix ? `/products?${suffix}` : "/products";
  const title = titleFor(query);
  const description = descriptionFor(query);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      url: path,
      title,
      description,
    },
    twitter: { card: "summary", title, description },
    robots:
      query.keyword || facetNoise ? { index: false, follow: true } : { index: true, follow: true },
  };
}

const GRID = "grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4";

function titleFor(query: CatalogQuery): string {
  if (query.keyword) return `“${query.keyword}”`;
  if (query.category) return "The collection";
  if (query.gender === "men") return "Menswear";
  if (query.gender === "women") return "Womenswear";
  return "Everything";
}

function GridSkeleton() {
  return (
    <div className={GRID}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[3/4] w-full" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

async function Filters({ searchParams }: { searchParams: SearchParamsPromise }) {
  // See the home page: keep cached reads out of the build, which has no backend.
  await connection();
  const query = parseCatalogQuery(toUrlSearchParams(await searchParams));
  const [categories, sizes, colors] = await Promise.all([
    getCategoryTree(),
    getFacetSizes(),
    getFacetColors(),
  ]);
  return (
    <FacetPanel query={query} categories={toFacetRoots(categories)} sizes={sizes} colors={colors} />
  );
}

async function Browse({ searchParams }: { searchParams: SearchParamsPromise }) {
  await connection();
  const query = parseCatalogQuery(toUrlSearchParams(await searchParams));
  const results = await searchProducts(query);
  const count = results.totalElements;

  return (
    <div className="space-y-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl md:text-3xl">{titleFor(query)}</h1>
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? "piece" : "pieces"}
        </p>
      </div>

      {count === 0 ? (
        <EmptyState
          title="Nothing matches those filters"
          description="Try removing a size or colour, or widen the price range."
          action={{ label: "Clear filters", href: "/products" }}
        />
      ) : (
        <>
          <div className={GRID}>
            {results.content.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 2} />
            ))}
          </div>
          <Pagination query={query} page={results} />
        </>
      )}
    </div>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: SearchParamsPromise }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[13rem_1fr] xl:gap-14">
      <div>
        <FacetDisclosure>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <Filters searchParams={searchParams} />
          </Suspense>
        </FacetDisclosure>
      </div>
      <Suspense fallback={<GridSkeleton />}>
        <Browse searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
