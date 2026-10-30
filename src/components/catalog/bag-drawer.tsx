"use client";

import Image from "next/image";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/catalog/format";
import type { components } from "@/lib/api/schema";

export type CartSnapshot = components["schemas"]["CartResponseDto"];

/**
 * The bag as it came back from the last successful mutation: the confirmation surface a
 * shopper needs between two products, driven by server truth rather than a local echo.
 *
 * Built on Base UI's Dialog so it is a genuine modal: focus is trapped and restored, the
 * page behind cannot scroll, Escape and outside presses close it, and the popup gets its
 * accessible name from the Title below.
 */
export function BagDrawer({
  open,
  onClose,
  cart,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartSnapshot | null;
}) {
  const items = cart?.items ?? [];
  const count = cart?.itemCount ?? 0;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30" />
        <DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col bg-background shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <DialogPrimitive.Title className="label-caps">Your bag · {count}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close bag"
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Review the pieces you have added, then continue to checkout.
          </DialogPrimitive.Description>

          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
              <p className="text-sm">Your bag is empty.</p>
              <p className="text-sm text-muted-foreground">
                Add a piece and it will be waiting here.
              </p>
            </div>
          ) : (
            <ul className="flex-1 divide-y overflow-y-auto px-5">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-4">
                  <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-muted">
                    {item.productImage ? (
                      <Image src={item.productImage} alt="" fill sizes="64px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.productName}</p>
                    <p className="label-caps mt-1 text-muted-foreground">
                      {[item.variantColorName, item.variantSize, `×${item.quantity}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="text-sm">{formatPrice(item.lineTotal)}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 border-t px-5 py-4">
            {items.length > 0 ? (
              <>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(cart?.grandTotal)}</span>
                </div>
                <Link href="/checkout" className={cn(buttonVariants(), "w-full")} onClick={onClose}>
                  Checkout
                </Link>
                <Link
                  href="/cart"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                  onClick={onClose}
                >
                  View bag
                </Link>
                <p className="text-xs text-muted-foreground">
                  Free delivery on every order · 3–5 working days
                </p>
              </>
            ) : (
              <Link href="/products" className={cn(buttonVariants(), "w-full")} onClick={onClose}>
                Browse the collection
              </Link>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
