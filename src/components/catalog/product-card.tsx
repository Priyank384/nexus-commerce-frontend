import Image from "next/image";
import Link from "next/link";
import { formatPrice, discountPercent } from "@/lib/catalog/format";
import type { ProductListItem } from "@/lib/catalog/server";
import { WishlistButton } from "./wishlist-button";

/**
 * Listing payloads carry `images: []` and only the hero `image`, so the card must not reach for
 * the gallery. `sizes` mirrors the grid breakpoints in `ProductGrid`; next/image needs it to
 * pick a width instead of assuming the card is full viewport.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductListItem;
  /** First row of a grid: the image is the LCP element, so it must not wait for a scroll hint. */
  priority?: boolean;
}) {
  const off = discountPercent(product.price ?? 0, product.compareAtPrice);
  const href = `/products/${product.slug}`;

  return (
    // The heart is a sibling of the link, not a child: a button inside an anchor is invalid
    // HTML and swallows the card navigation on some browsers.
    <div className="group relative">
      <Link href={href} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {product.image ? (
            <Image
              src={product.image}
              alt={product.title ?? "Product"}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, (min-width: 480px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
            />
          ) : null}
          {off ? (
            <span className="label-caps absolute top-3 left-3 bg-background px-2 py-1 text-[11px]">
              −{off}%
            </span>
          ) : null}
        </div>
        <div className="mt-3 space-y-1">
          <p className="label-caps text-muted-foreground">{product.category}</p>
          <h3 className="truncate text-sm text-foreground">{product.title}</h3>
          <p className="flex items-baseline gap-2 text-sm">
            <span>{formatPrice(product.price)}</span>
            {product.compareAtPrice ? (
              <span className="text-muted-foreground line-through">{formatPrice(product.compareAtPrice)}</span>
            ) : null}
          </p>
        </div>
      </Link>
      {product.id ? (
        <WishlistButton productId={product.id} className="absolute top-3 right-3 size-9" />
      ) : null}
    </div>
  );
}
