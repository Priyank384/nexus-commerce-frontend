import { absoluteUrl, SITE_NAME } from "@/lib/site";
import type { ProductListItem } from "@/lib/catalog/server";

/**
 * Structured data for a product page. Google reads Product + BreadcrumbList from the same
 * document, so both ride one script. Data is built from server props and serialised with `<`
 * escaped — a product title may legitimately contain markup characters.
 */
export function ProductJsonLd({ product }: { product: ProductListItem }) {
  const url = absoluteUrl(`/products/${product.slug}`);
  const images = [
    ...(product.images ?? []).map((image) => image.url),
    product.image,
  ]
    .filter((src): src is string => Boolean(src))
    .map((src) => (src.startsWith("http") ? src : absoluteUrl(src)));

  const prices = (product.variants ?? [])
    .map((variant) => variant.price)
    .filter((price): price is number => typeof price === "number" && price > 0);
  const lowPrice = prices.length ? Math.min(...prices) : product.price;
  const highPrice = prices.length ? Math.max(...prices) : product.price;
  const inStock = (product.stock ?? 0) > 0;

  const breadcrumb = [
    { name: "Home", item: absoluteUrl("/") },
    { name: "Shop", item: absoluteUrl("/products") },
    ...(product.gender ? [{ name: product.gender, item: absoluteUrl(`/products?gender=${product.gender.toLowerCase()}`) }] : []),
    ...(product.category ? [{ name: product.category, item: absoluteUrl(`/products?category=${product.categorySlug}`) }] : []),
    { name: product.title ?? "Product", item: url },
  ].map((entry, index) => ({ "@type": "ListItem", position: index + 1, ...entry }));

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: images,
    url,
    sku: product.variants?.find((variant) => variant.sku)?.sku,
    brand: { "@type": "Brand", name: product.brand || SITE_NAME },
    material: product.material,
    category: product.category,
    ...(lowPrice
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "INR",
            lowPrice,
            highPrice,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url,
          },
        }
      : {}),
    ...((product.reviewCount ?? 0) > 0 && (product.rating ?? 0) > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  const data = [
    productLd,
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumb },
  ];

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output with `<` escaped cannot close the script element early.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
