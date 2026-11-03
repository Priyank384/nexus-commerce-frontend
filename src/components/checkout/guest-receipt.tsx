"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import { formatPrice } from "@/lib/catalog/format";
import { paymentStatus as paymentBadge, type PaymentStatus } from "@/lib/orders/format";
import { useSession } from "@/lib/auth/session";
import { RazorpayScript } from "./razorpay";
import { usePayOrder } from "./use-pay-order";

type Receipt = {
  orderId?: number;
  orderStatus?: "PENDING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  paymentStatus?: PaymentStatus | null;
  totalPrice?: number;
};

async function fetchReceipt(orderId: number): Promise<Receipt> {
  const { data, error, response } = await api.GET("/api/v1/payments/orders/{orderId}/status", {
    params: { path: { orderId } },
  });
  if (!response.ok || !data?.data) {
    throw new HttpError(response.status, toAuthFailure(response.status, error ?? null).message);
  }
  return data.data;
}

/**
 * The gateway settles out of band, so a page that stops looking shows "pending" to a shopper
 * who has already paid. Poll until the money lands, then stop — a cancelled order settles
 * immediately and a lost one should not keep a browser hitting the store forever.
 */
const POLL_MS = 3000;
const POLL_LIMIT = 40;

export function GuestReceipt() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useSession((state) => state.user);
  const { pay, payingFor } = usePayOrder();

  const id = Number(params?.orderId);
  const justPaid = searchParams.get("paid") === "1";

  // The hook does not expose how many times it has refetched, so the window is bounded by a
  // deadline: past it the page stops asking and has to stop promising an automatic update.
  const [stopped, setStopped] = useState(false);

  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["receipt", id],
    queryFn: () => fetchReceipt(id),
    enabled: Number.isInteger(id) && id > 0,
    refetchInterval: (query) => {
      // A rejected credential or a missing order is a settled fact about this browser, not a
      // payment that has yet to land — asking again every few seconds changes neither.
      if (query.state.error) return false;
      const state = query.state.data;
      if (state?.paymentStatus === "PAID" || state?.orderStatus === "CANCELLED") return false;
      return stopped ? false : POLL_MS;
    },
  });

  const paid = data?.paymentStatus === "PAID";
  const cancelled = data?.orderStatus === "CANCELLED";
  const failed = data?.paymentStatus === "FAILED";
  const payable = !paid && !cancelled && data != null;
  const settledByData = Boolean(paid || cancelled || failed);
  const hasData = data != null;
  useEffect(() => {
    if (!hasData || settledByData) return;
    const timer = setTimeout(() => setStopped(true), POLL_MS * POLL_LIMIT);
    return () => clearTimeout(timer);
  }, [hasData, settledByData]);
  const waiting = hasData && !settledByData && !stopped;

  async function onPay() {
    if (!data?.orderId) return;
    const result = await pay(data.orderId);
    if (result.status === "paid") {
      toast.success("Payment captured");
      router.replace(`/checkout/done/${result.orderId}?paid=1`);
      return;
    }
    if (result.status === "dismissed") {
      toast("Payment window closed — the order is still waiting.");
      return;
    }
    toast.error(result.message);
  }

  if (!Number.isInteger(id) || id <= 0) return <Unknown />;

  if (isPending) return <ReceiptSkeleton />;

  if (isError || !data) {
    const status = error instanceof HttpError ? error.status : 0;
    // 401 means the credential behind this order is not in this browser: a different device, a
    // cleared storage, or a session that has since expired. 403 means a credential is present
    // but no longer owns it — almost always the claim link having moved the order onto an
    // account. Both are answers, so the page that offers a retry promises something a retry
    // cannot deliver.
    if (status === 401 || status === 403 || status === 404) return <Unknown />;
    return (
      <div className="border-y py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {error instanceof HttpError ? error.message : "Could not load this order."}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const badge = paymentBadge(data.paymentStatus);

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <RazorpayScript />

      <section
        aria-labelledby="receipt-heading"
        className="border p-6 text-center md:p-10"
        aria-live="polite"
      >
        {paid ? (
          <CheckCircle2 aria-hidden className="mx-auto size-8" />
        ) : cancelled || failed ? (
          <TriangleAlert aria-hidden className="mx-auto size-8 text-destructive" />
        ) : (
          <Loader2 aria-hidden className="mx-auto size-8 animate-spin text-muted-foreground" />
        )}
        <h1 id="receipt-heading" className="mt-4 text-2xl md:text-3xl">
          {paid
            ? "Thank you — it is paid"
            : cancelled
              ? "This order was cancelled"
              : failed
                ? "The payment did not go through"
                : justPaid
                  ? "Confirming your payment"
                  : "Order placed"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Order <span className="text-foreground">#{data.orderId}</span> ·{" "}
          {formatPrice(data.totalPrice)}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Badge variant={badge.tone}>{badge.label}</Badge>
        </div>
        <p className="mt-5 text-sm leading-6">
          {paid
            ? "A receipt is on its way to your email with the delivery updates. Keep it — the link inside lets you hand this order to an account whenever you like."
            : cancelled
              ? "Nothing was charged. Browse the collection whenever you are ready to try again."
              : failed
                ? "Nothing has been charged. You can try the payment again from here."
                : waiting
                  ? "We are still waiting on the gateway. This page updates on its own, so there is nothing to do but wait a few seconds."
                  : "The gateway has not confirmed this yet, and we have stopped checking. Pay from here, or open the receipt link in your email later."}
        </p>
      </section>

      {payable ? (
        <section aria-labelledby="pay-heading" className="border p-6">
          <h2 id="pay-heading" className="label-caps text-muted-foreground">
            Still to pay
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {failed
              ? "The order is saved and nothing was charged. You can try the payment again."
              : "This order is saved but the payment has not landed. You can pay from here."}
          </p>
          <Button
            type="button"
            className="mt-4 w-full"
            onClick={onPay}
            disabled={payingFor !== null}
          >
            {payingFor !== null ? "Opening payment…" : `Pay ${formatPrice(data.totalPrice)}`}
          </Button>
        </section>
      ) : null}

      <section aria-labelledby="keep-heading" className="border p-6">
        <h2 id="keep-heading" className="label-caps text-muted-foreground">
          Keep this order
        </h2>
        <p className="mt-3 text-sm leading-6">
          {user
            ? "Sign in on the claim page to move this order into your account."
            : "This order belongs to this browser until you claim it. Create an account and use the link in your receipt email to hand it over — after that it lives in your order history."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {user ? (
            <Link href="/orders/claim" className={buttonVariants({ size: "sm" })}>
              Claim an order
            </Link>
          ) : (
            <Link href="/register?next=%2Forders%2Fclaim" className={buttonVariants({ size: "sm" })}>
              Create an account
            </Link>
          )}
          <Link href="/products" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Continue shopping
          </Link>
        </div>
      </section>

      {waiting ? (
        <p className="text-center text-xs text-muted-foreground" suppressHydrationWarning>
          Last checked{" "}
          {new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour12: false })}
        </p>
      ) : null}
    </div>
  );
}

function Unknown() {
  return (
    <div className="mx-auto max-w-xl space-y-6 border-y py-16 text-center">
      <h1 className="text-xl">We cannot find that order in this browser</h1>
      <p className="text-sm text-muted-foreground">
        Guest orders stay with the device that placed them. Open the link from your receipt
        email, or sign in if you have since created an account.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Sign in
        </Link>
        <Link href="/orders/claim" className={buttonVariants({ size: "sm" })}>
          Claim with a link
        </Link>
      </div>
    </div>
  );
}

function ReceiptSkeleton() {
  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-4 border p-10 text-center">
        <Skeleton className="mx-auto size-8 rounded-full" />
        <Skeleton className="mx-auto h-8 w-64" />
        <Skeleton className="mx-auto h-4 w-40" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
