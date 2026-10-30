"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/catalog/format";
import { HttpError } from "@/lib/api/errors";
import { useCartMutations, useCartQuery, type CartLine } from "@/lib/cart/queries";

export function CartView() {
  const { data: cart, isPending, isError, error, refetch } = useCartQuery();

  if (isPending) return <CartSkeleton />;

  if (isError) {
    return (
      <div className="border-y py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {error instanceof HttpError ? error.message : "Could not load your bag."}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="space-y-8">
        <CartHeading count={0} />
        <EmptyState
          title="Your bag is empty"
          description="Start with the staples — organic cotton, clean lines, made to be worn for years."
          action={{ label: "Browse the collection", href: "/products" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <CartHeading count={cart?.itemCount ?? 0} />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <ul className="divide-y border-y">
          {items.map((item) => (
            <CartLineRow key={item.id} line={item} />
          ))}
        </ul>
        <CartSummary cart={cart} />
      </div>
    </div>
  );
}

function CartHeading({ count }: { count: number }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <p className="label-caps text-muted-foreground">Bag</p>
        <h1 className="mt-2 text-2xl md:text-3xl">Your bag</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {count === 1 ? "1 item" : `${count} items`}
      </p>
    </header>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const { setQuantity, removeItem } = useCartMutations();
  const quantity = line.quantity ?? 1;
  const stock = line.variantStock ?? 0;
  const updating = setQuantity.isPending && setQuantity.variables?.itemId === line.id;
  const removing = removeItem.isPending && removeItem.variables === line.id;
  const variant = [line.variantColorName, line.variantSize].filter(Boolean).join(" · ");

  function onQuantity(next: number) {
    setQuantity.mutate(
      { itemId: line.id!, quantity: next },
      {
        onError: (error) =>
          toast.error(error instanceof HttpError ? error.message : "Could not update the bag."),
      },
    );
  }

  function onRemove() {
    removeItem.mutate(line.id!, {
      onError: (error) =>
        toast.error(error instanceof HttpError ? error.message : "Could not remove the item."),
    });
  }

  return (
    <li className={cn("flex gap-4 py-6 sm:gap-6", (updating || removing) && "opacity-60")}>
      <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-muted sm:w-24">
        {line.productImage ? (
          <Image
            src={line.productImage}
            alt=""
            fill
            sizes="(min-width: 640px) 96px, 80px"
            className="object-cover"
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm">{line.productName}</p>
          <p className="label-caps mt-1.5 flex items-center gap-2 text-muted-foreground">
            {line.variantColorHex ? (
              <span
                aria-hidden
                className="size-2.5 rounded-full ring-1 ring-border"
                style={{ backgroundColor: line.variantColorHex }}
              />
            ) : null}
            {variant || "One size"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{formatPrice(line.unitPrice)} each</p>
          {stock === 0 ? (
            <p className="mt-1 text-xs text-destructive">Sold out while it sat in your bag</p>
          ) : stock <= 5 ? (
            <p className="mt-1 text-xs text-muted-foreground">Only {stock} left</p>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-6 sm:flex-col sm:items-end sm:gap-3">
          <div className="inline-flex items-center border">
            <button
              type="button"
              aria-label={`Decrease quantity of ${line.productName}`}
              disabled={updating || quantity <= 1}
              onClick={() => onQuantity(quantity - 1)}
              className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <Minus aria-hidden className="size-3.5" />
            </button>
            <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
            <span aria-live="polite" className="sr-only">
              {line.productName} quantity {quantity}
            </span>
            <button
              type="button"
              aria-label={`Increase quantity of ${line.productName}`}
              disabled={updating || (stock > 0 && quantity >= stock)}
              onClick={() => onQuantity(quantity + 1)}
              className="flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              <Plus aria-hidden className="size-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-2">
            <p className="text-sm tabular-nums">{formatPrice(line.lineTotal)}</p>
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              aria-label={`Remove ${line.productName} from bag`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

function CartSummary({ cart }: { cart: ReturnType<typeof useCartQuery>["data"] }) {
  return (
    <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-24 lg:self-start">
      <div className="border p-6">
        <h2 id="summary-heading" className="label-caps text-muted-foreground">
          Summary
        </h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(cart?.grandTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd>Free</dd>
          </div>
          <div className="flex justify-between border-t pt-3 text-base">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatPrice(cart?.grandTotal)}</dd>
          </div>
        </dl>
        <p className="mt-1.5 text-xs text-muted-foreground">Prices include all taxes.</p>
        <Link href="/checkout" className={cn(buttonVariants(), "mt-6 w-full")}>
          Checkout
        </Link>
        <Link
          href="/products"
          className="mt-4 block text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Continue shopping
        </Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        Free delivery on every order · 3–5 working days
      </p>
    </aside>
  );
}

function CartSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
        <div className="space-y-6 border-y py-6">
          {[0, 1].map((row) => (
            <div key={row} className="flex gap-6">
              <Skeleton className="aspect-[4/5] w-24 shrink-0" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
