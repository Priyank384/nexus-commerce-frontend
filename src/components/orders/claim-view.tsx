"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/catalog/format";
import { HttpError } from "@/lib/api/errors";
import { itemCount, orderStatus, paymentStatus, type Order } from "@/lib/orders/format";
import { useClaimOrder } from "@/lib/orders/queries";

/**
 * The page behind the link in a guest's receipt email.
 *
 * Claiming is one-way: the order leaves the guest token, lands on this account, and the link is
 * retired so a forwarded email cannot hand the same order to a second shopper. Nothing here
 * should be able to do that by accident, which is why the token is shown as a button to press
 * rather than claimed the moment the page opens.
 */
export function ClaimView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token] = useState(() => searchParams.get("token")?.trim() ?? "");
  const [claimed, setClaimed] = useState<Order | null>(null);
  const claim = useClaimOrder();

  function onClaim() {
    claim.mutate(token, {
      onSuccess: (order) => {
        setClaimed(order);
        // The address now holds a credential that has been spent. Leaving it there means a reload,
        // a bookmark, or a shoulder-glance at the bar all answer "this link is not valid".
        router.replace("/orders/claim");
      },
    });
  }

  if (claimed) {
    const paid = paymentStatus(claimed.paymentStatus);
    const status = orderStatus(claimed.orderStatus);
    return (
      <div className="mx-auto w-full max-w-lg">
        <CheckCircle2 aria-hidden className="size-8 text-muted-foreground" />
        <h1 className="mt-3 text-2xl">This order is yours now</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Order <span className="text-foreground">#{claimed.id}</span> is in your order history, and
          the link that brought you here will not work a second time.
        </p>

        <dl className="mt-6 divide-y border-y text-sm">
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">Items</dt>
            <dd>{itemCount(claimed)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">Total</dt>
            <dd>{formatPrice(claimed.totalPrice)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">Order</dt>
            <dd>
              <Badge variant={status.tone}>{status.label}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <dt className="text-muted-foreground">Payment</dt>
            <dd>
              <Badge variant={paid.tone}>{paid.label}</Badge>
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={`/orders/${claimed.id}`} className={buttonVariants({ size: "sm" })}>
            View the order
          </Link>
          <Link href="/products" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (claim.isError) {
    // Anything the server refuses to attach is a link problem, not a form problem: the token is
    // gone whether it was never real or already spent, and only a fresh email fixes either.
    const failure = claim.error instanceof HttpError ? claim.error : null;
    return (
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-semibold">This link will not claim an order</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {failure?.message ??
            "That claim link is not valid, has already been used, or belongs to a deleted order."}
        </p>
        {failure && failure.status >= 500 ? (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>
              The store refused the request rather than the link. Try again from the email, and if it
              keeps failing the order is still safe.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/orders" className={buttonVariants({ size: "sm" })}>
            See your orders
          </Link>
          <Link href="/products" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <h1 className="text-2xl font-semibold">Claim an order</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Orders placed without an account are claimed with the link in their receipt email — it
          carries the one-time token this page needs, and there is nothing to type.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Open that link while signed in and the order moves into your history. Nothing arrives here
          by guessing an order number.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/orders" className={buttonVariants({ variant: "outline", size: "sm" })}>
            See your orders
          </Link>
          <Link href="/products" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="text-2xl font-semibold">Claim this order</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The link in your receipt identifies one guest order. Claiming moves it onto{" "}
        <span className="text-foreground">this account</span>, so it appears in your order history
        and any future sign-in can find it.
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The link only works once. After this, the same email will say it is no longer valid.
      </p>
      <Button type="button" className="mt-6 w-full" onClick={onClaim} disabled={claim.isPending}>
        {claim.isPending ? "Claiming…" : "Claim this order"}
      </Button>
      <p className="mt-4 text-sm text-muted-foreground">
        Not the order you meant to claim?{" "}
        <Link href="/products" className="underline">
          Keep shopping
        </Link>{" "}
        — leaving this page alone keeps the order on the email.
      </p>
    </div>
  );
}
