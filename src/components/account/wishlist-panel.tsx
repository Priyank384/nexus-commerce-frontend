"use client";

import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HttpError } from "@/lib/api/errors";
import { formatPrice } from "@/lib/catalog/format";
import { useCartMutations } from "@/lib/cart/queries";
import { useWishlistQuery, useWishlistToggle, type WishlistItem } from "@/lib/wishlist/queries";

function variantLine(item: WishlistItem): string {
  const parts = [item.colorName, item.size].filter(Boolean);
  return parts.length ? parts.join(" · ") : "One size";
}

export function WishlistPanel() {
  const wishlist = useWishlistQuery(true);
  const { remove } = useWishlistToggle();
  const { addItem } = useCartMutations();
  const items = wishlist.data?.items ?? [];

  async function onRemove(item: WishlistItem) {
    if (!item.productId) return;
    try {
      await remove.mutateAsync(item.productId);
      toast.success("Removed from saved pieces");
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not update your wishlist.");
    }
  }

  async function onAddToBag(item: WishlistItem) {
    if (!item.productId) return;
    try {
      await addItem.mutateAsync({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
      });
      toast.success("Added to your bag");
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not add this to your bag.");
    }
  }

  if (wishlist.isPending) return <Skeleton className="h-56 w-full" />;

  if (wishlist.isError) {
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        We could not load your saved pieces.
      </p>
    );
  }

  if (!items.length) {
    return (
      <div className="border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nothing saved yet. Tap the heart on any piece to keep it here.
        </p>
        <Link href="/products" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-5" })}>
          Browse the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg">Saved pieces</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "piece" : "pieces"}, kept across devices.
        </p>
      </div>

      <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const productId = item.productId ?? 0;
          const href = `/products/${item.productSlug ?? ""}`;
          return (
            <li key={item.id ?? `/saved/${productId}`} className="group">
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <Link href={href} aria-label={item.productTitle ?? "Saved piece"}>
                  {item.productImage ? (
                    <Image
                      src={item.productImage}
                      alt={item.productTitle ?? "Saved piece"}
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  ) : null}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${item.productTitle ?? "piece"} from saved pieces`}
                  disabled={remove.isPending}
                  onClick={() => onRemove(item)}
                  className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full border bg-background/85 backdrop-blur transition-colors hover:border-foreground"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
              <div className="mt-3 space-y-1">
                <h3 className="truncate text-sm">
                  <Link href={href} className="underline-offset-4 hover:underline">
                    {item.productTitle ?? "Saved piece"}
                  </Link>
                </h3>
                <p className="text-xs text-muted-foreground">{variantLine(item)}</p>
                {item.price != null ? <p className="text-sm">{formatPrice(item.price)}</p> : null}
              </div>
              <div className="mt-3">
                {item.variantId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={addItem.isPending}
                    onClick={() => onAddToBag(item)}
                  >
                    {addItem.isPending ? "Adding…" : "Add to bag"}
                  </Button>
                ) : (
                  // No size was saved with the heart, and the API refuses to guess one, so the
                  // chooser has to be the product page.
                  <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Choose a size
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
