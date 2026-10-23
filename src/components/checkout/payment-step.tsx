"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/catalog/format";
import type { Order } from "@/lib/orders/format";
import { AddressSummary, type AddressLike } from "./summary";

export function PaymentStep({
  order,
  address,
  total,
  busy,
  notice,
  error,
  onPay,
  onBack,
}: {
  order: Order | null;
  address: AddressLike | null;
  total: number;
  busy: boolean;
  notice: string | null;
  error: string | null;
  onPay: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg">Payment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {order
            ? `Order #${order.id} is saved. Finish payment whenever you're ready.`
            : "Review the delivery details, then pay securely."}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="border p-4">
        <div className="flex items-start justify-between gap-4">
          <p className="label-caps text-muted-foreground">Deliver to</p>
          {!order ? (
            <button
              type="button"
              onClick={onBack}
              className="text-sm underline underline-offset-4 hover:text-muted-foreground"
            >
              Change
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <AddressSummary address={address} />
        </div>
      </div>

      <div className="border p-4">
        <p className="label-caps text-muted-foreground">Payment method</p>
        <p className="mt-3 text-sm">Razorpay · UPI, cards and netbanking</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock aria-hidden className="size-3.5" />
          Payments are processed by Razorpay. We never see your card details.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        {order ? (
          <Link href={`/orders/${order.id}`} className={cn(buttonVariants({ variant: "outline" }))}>
            View order
          </Link>
        ) : (
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
        )}
        <Button type="button" onClick={onPay} disabled={busy} className="min-w-40">
          {busy ? "Opening payment…" : `Pay ${formatPrice(total)}`}
        </Button>
      </div>
    </div>
  );
}
