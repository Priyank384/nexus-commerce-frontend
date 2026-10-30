"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProductGallery, type GalleryImage } from "./product-gallery";
import { BagDrawer, type CartSnapshot } from "./bag-drawer";
import { WishlistButton } from "./wishlist-button";
import { HttpError } from "@/lib/api/errors";
import { useCartMutations } from "@/lib/cart/queries";
import { discountPercent, formatPrice, groupVariantsByColor, imageUrlForColor } from "@/lib/catalog/format";
import type { ProductListItem } from "@/lib/catalog/server";

/** Sizes the fit guide quotes; the numbers are our own block pattern, not a supplier claim. */
const FIT_TABLE: { size: string; chest: string; length: string }[] = [
  { size: "XS", chest: '34–36"', length: '27"' },
  { size: "S", chest: '37–39"', length: '28"' },
  { size: "M", chest: '40–42"', length: '29"' },
  { size: "L", chest: '43–45"', length: '30"' },
  { size: "XL", chest: '46–48"', length: '31"' },
  { size: "XXL", chest: '49–51"', length: '32"' },
];

export function ProductPurchase({ product }: { product: ProductListItem }) {
  const pathname = usePathname();
  const router = useRouter();
  const images: GalleryImage[] = useMemo(() => {
    const gallery = (product.images ?? [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((image) => ({ url: image.url ?? "", alt: image.alt ?? product.title ?? "Product" }))
      .filter((image) => image.url);
    if (gallery.length) return gallery;
    return product.image ? [{ url: product.image, alt: product.title ?? "Product" }] : [];
  }, [product]);

  const colors = useMemo(() => groupVariantsByColor(product.variants ?? []), [product.variants]);
  const [colorName, setColorName] = useState<string | null>(
    () => colors.find((color) => color.totalStock > 0)?.name ?? colors[0]?.name ?? null,
  );
  const [requestedSize, setRequestedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartSnapshot | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Shares the cart cache with the rest of the app, so the drawer, the badge and /cart
  // all see the same server snapshot instead of each holding a private copy.
  const { addItem } = useCartMutations();

  const color = colors.find((entry) => entry.name === colorName) ?? colors[0] ?? null;
  // A size chosen for another colour may not exist (or may be sold out) here, so the effective
  // size is derived on every render instead of copied into state by an effect.
  const size =
    color?.sizes.find((entry) => entry.size === requestedSize)?.size ??
    color?.sizes.find((entry) => entry.totalStock > 0)?.size ??
    color?.sizes[0]?.size ??
    null;

  const variant = (product.variants ?? []).find(
    (entry) => entry.colorName === color?.name && entry.size === size,
  );
  const stock = variant?.stock ?? 0;
  const price = variant?.price ?? product.price ?? 0;
  const unitImage = imageUrlForColor(product.variants ?? [], color?.name ?? "");
  const percentOff = discountPercent(product.price ?? 0, product.compareAtPrice);

  async function addToBag() {
    if (!product.id) return;
    try {
      const next = await addItem.mutateAsync({
        productId: product.id,
        quantity,
        ...(variant?.id ? { variantId: variant.id } : {}),
      });
      setCart(next);
      setDrawerOpen(true);
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        toast.error("Sign in to keep your bag");
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      toast.error(error instanceof HttpError ? error.message : "Could not reach the store. Try again.");
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16">
      <ProductGallery
        images={images}
        overrideUrl={unitImage}
        overrideAlt={color?.name ? `${product.title} in ${color.name}` : undefined}
      />

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="label-caps text-muted-foreground">{product.category}</p>
        <h1 className="mt-2 text-2xl md:text-3xl">{product.title}</h1>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-lg">{formatPrice(price)}</span>
          {percentOff ? (
            <>
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
              <span className="label-caps text-muted-foreground">−{percentOff}%</span>
            </>
          ) : null}
        </div>

        <p className="mt-5 text-sm leading-6 text-muted-foreground">{product.description}</p>

        {colors.length > 1 ? (
          <fieldset className="mt-8">
            <legend className="label-caps mb-3 text-muted-foreground">
              Colour <span className="text-foreground">· {color?.name}</span>
            </legend>
            <div className="flex flex-wrap gap-3">
              {colors.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => setColorName(option.name)}
                  aria-label={option.name}
                  aria-pressed={option.name === color?.name}
                  title={option.totalStock === 0 ? `${option.name} — sold out` : option.name}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: option.hex ?? "#e5e5e5" }}
                    className={
                      option.name === color?.name
                        ? "size-8 rounded-full ring-1 ring-foreground ring-offset-2 ring-offset-background"
                        : "size-8 rounded-full ring-1 ring-border group-hover:ring-foreground/40"
                    }
                  />
                  <span className="sr-only">{option.name}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}

        {color && color.sizes.length > 1 ? (
          <fieldset className="mt-7">
            {/* A legend shrink-wraps, so justify-between needs an explicit full width. */}
            <legend className="label-caps mb-3 flex w-full items-center justify-between text-muted-foreground">
              <span>
                Size <span className="text-foreground">· {size}</span>
              </span>
              <Dialog>
                <DialogTrigger
                  className={
                    "inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
                  }
                >
                  <Ruler aria-hidden className="size-3.5" />
                  Fit guide
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Fit guide</DialogTitle>
                    <DialogDescription>
                      Measured flat on our blocks. Take the size you wear in a similar weight.
                    </DialogDescription>
                  </DialogHeader>
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="border-b text-left label-caps text-muted-foreground">
                        <th className="py-2 font-normal">Size</th>
                        <th className="py-2 font-normal">Chest</th>
                        <th className="py-2 font-normal">Body length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FIT_TABLE.map((row) => (
                        <tr key={row.size} className="border-b last:border-0">
                          <td className="py-2">{row.size}</td>
                          <td className="py-2 text-muted-foreground">{row.chest}</td>
                          <td className="py-2 text-muted-foreground">{row.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DialogContent>
              </Dialog>
            </legend>
            <div className="flex flex-wrap gap-2">
              {color.sizes.map((entry) => {
                const soldOut = entry.totalStock === 0;
                return (
                  <button
                    key={entry.size}
                    type="button"
                    disabled={soldOut}
                    onClick={() => setRequestedSize(entry.size)}
                    aria-pressed={entry.size === size}
                    className={
                      entry.size === size
                        ? "min-w-12 border border-foreground bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40"
                        : "min-w-12 border border-border px-3 py-2 text-sm hover:border-foreground disabled:border-border disabled:text-muted-foreground/40 disabled:line-through"
                    }
                  >
                    {entry.size}
                    {soldOut ? <span className="sr-only"> — sold out</span> : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <p className="mt-5 text-sm" role="status" aria-live="polite">
          {stock === 0 ? (
            <span className="text-muted-foreground">Sold out in {color?.name} · {size}</span>
          ) : stock <= 5 ? (
            <span>Only {stock} left</span>
          ) : (
            <span className="text-muted-foreground">In stock · ready to ship</span>
          )}
        </p>
        {variant?.sku ? (
          <p className="mt-1 text-xs text-muted-foreground">Style {variant.sku}</p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center border">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="px-2.5 py-2 disabled:opacity-30"
            >
              <Minus aria-hidden className="size-3.5" />
            </button>
            <span className="w-8 text-center text-sm">
              {quantity}
            </span>
            {/* The visible number alone would announce as a bare "2"; the live region
                says what changed. */}
            <span aria-live="polite" className="sr-only">
              Quantity {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= stock}
              onClick={() => setQuantity((value) => Math.min(stock, value + 1))}
              className="px-2.5 py-2 disabled:opacity-30"
            >
              <Plus aria-hidden className="size-3.5" />
            </button>
          </div>
          <Button
            size="lg"
            className="h-11 flex-1"
            disabled={stock === 0 || addItem.isPending}
            onClick={addToBag}
          >
            {addItem.isPending ? "Adding…" : stock === 0 ? "Sold out" : `Add to bag · ${formatPrice(price * quantity)}`}
          </Button>
          <WishlistButton
            productId={product.id ?? 0}
            variantId={variant?.id}
            className="size-11 shrink-0"
          />
        </div>

        <dl className="mt-8 space-y-2 border-t pt-6 text-sm">
          {product.material ? (
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">Material</dt>
              <dd className="text-right">{product.material}</dd>
            </div>
          ) : null}
          {product.careInstructions ? (
            <div className="flex justify-between gap-6">
              <dt className="text-muted-foreground">Care</dt>
              <dd className="text-right">{product.careInstructions}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-6">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-right">Free delivery · 3–5 working days</dd>
          </div>
        </dl>
      </div>

      <BagDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} cart={cart} />
    </div>
  );
}
