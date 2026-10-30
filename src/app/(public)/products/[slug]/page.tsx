import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPurchase } from "@/components/catalog/product-purchase";
import { FOUR_UP_SIZES, ProductCard } from "@/components/catalog/product-card";
import { ProductReviews } from "@/components/reviews/product-reviews";
import { ProductJsonLd } from "@/components/seo/product-json-ld";
import { getProductBySlug, searchProducts } from "@/lib/catalog/server";
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME } from "@/lib/site";

type Params = Promise<{ slug: string }>;

/**
 * generateMetadata and the page both need the product; React's cache folds that into one
 * upstream call per request instead of two.
 */
const loadProduct = cache((slug: string) => getProductBySlug(slug));

async function loadOr404(slug: string) {
  const product = await loadProduct(slug);
  // Cache Components has already streamed this route's shell by the time the response
  // resolves, so this not-found renders with a 200 (a soft 404). Next marks it `noindex`,
  // which is the documented trade-off; a hard status would need a proxy pre-check that
  // costs every live product view a backend round trip.
  if (!product) notFound();
  return product;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  // The page raises notFound() itself; with no product there is no head to write.
  if (!product) return {};
  const title = product.title ?? SITE_NAME;
  const description = product.description?.slice(0, 160) || SITE_DESCRIPTION;
  const image = product.image ? [{ url: product.image, alt: title }] : undefined;
  const path = `/products/${product.slug ?? slug}`;
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
      images: image,
    },
    twitter: { card: "summary_large_image", title, description, images: product.image ? [product.image] : undefined },
  };
}

/**
 * The page awaits per-request data, so it has no instant static shell; `instant = false`
 * tells the Cache Components validator that blocking this segment is intentional. At runtime
 * the shell still streams, which is why a missing slug renders the 404 UI with a 200.
 */
export const instant = false;

export default async function ProductPage({ params }: { params: Params }) {
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
      <ProductJsonLd product={product} />
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

      <ProductReviews
        productId={product.id ?? 0}
        productTitle={product.title ?? "this piece"}
        rating={product.rating}
        reviewCount={product.reviewCount}
      />

      {others.length ? (
        <section aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl md:text-2xl">
            More from {product.category}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
            {others.map((entry) => (
              <ProductCard key={entry.id} product={entry} sizes={FOUR_UP_SIZES} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
