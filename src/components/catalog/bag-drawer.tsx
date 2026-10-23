"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/catalog/format";
import type { components } from "@/lib/api/schema";

export type CartSnapshot = components["schemas"]["CartResponseDto"];

/**
 * The bag as it came back from the last successful mutation. A full cart page with its own
 * quantity controls lands in Phase 4; this is the confirmation surface a shopper needs between
 * two products, and it is driven by server truth rather than a local echo.
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
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const items = cart?.items ?? [];

  return (
    <div role="dialog" aria-modal="true" aria-label="Your bag" className="fixed inset-0 z-50">
      <button type="button" aria-label="Close bag" onClick={onClose} className="absolute inset-0 bg-black/20" />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <p className="label-caps">Your bag · {cart?.itemCount ?? 0}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <ul className="flex-1 divide-y overflow-y-auto px-5">
          {items.length === 0 ? (
            <li className="py-10 text-center text-sm text-muted-foreground">Your bag is empty.</li>
          ) : null}
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

        <div className="space-y-3 border-t px-5 py-4">
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
          <p className="text-xs text-muted-foreground">Free delivery on every order · 3–5 working days</p>
        </div>
      </div>
    </div>
  );
}
