"use client";

import type { MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth/session";
import { HttpError } from "@/lib/api/errors";
import { savedProductIds, useWishlistQuery, useWishlistToggle } from "@/lib/wishlist/queries";
import { cn } from "@/lib/utils";

/**
 * One heart per surface. Signing in is required before the write, so the click doubles as
 * the prompt: a signed-out shopper is sent to login with a return path instead of a 401.
 */
export function WishlistButton({
  productId,
  variantId,
  className,
}: {
  productId: number;
  /** The size+colour chosen on a product page; cards save the product itself. */
  variantId?: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated } = useSession();
  const wishlist = useWishlistQuery(Boolean(user));
  const { add, remove } = useWishlistToggle();
  const saved = savedProductIds(wishlist.data).has(productId);
  const pending = add.isPending || remove.isPending;

  async function toggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!hydrated) return;
    if (!user) {
      toast.error("Sign in to save pieces");
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    try {
      if (saved) await remove.mutateAsync(productId);
      else await add.mutateAsync({ productId, ...(variantId ? { variantId } : {}) });
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not update your wishlist.");
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!hydrated || pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border bg-background/85 backdrop-blur transition-colors",
        saved ? "border-foreground" : "border-border hover:border-foreground",
        className,
      )}
    >
      <Heart aria-hidden className={cn("size-4", saved && "fill-foreground")} />
    </button>
  );
}
