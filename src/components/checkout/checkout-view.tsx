"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session";
import { CART_KEY, useAddressesQuery, useCartQuery, type Cart } from "@/lib/cart/queries";
import type { Order } from "@/lib/orders/format";
import { cn } from "@/lib/utils";
import type { ContactValues } from "@/lib/validation/checkout";
import { ContactStep } from "./contact-step";
import { DeliveryStep } from "./delivery-step";
import { PaymentStep } from "./payment-step";
import { RazorpayScript } from "./razorpay";
import { CheckoutSummary, type SummaryLine } from "./summary";
import { usePayOrder } from "./use-pay-order";

const STEPS = [
  { number: 1, label: "Contact" },
  { number: 2, label: "Delivery" },
  { number: 3, label: "Payment" },
] as const;

type Step = (typeof STEPS)[number]["number"];

export function CheckoutView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSession((state) => state.user);
  const cartQuery = useCartQuery();
  const addressesQuery = useAddressesQuery();
  const { pay, payingFor } = usePayOrder();

  const [step, setStep] = useState<Step>(1);
  const [contact, setContact] = useState<ContactValues | null>(null);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [placing, setPlacing] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  // Survives a failed request without surviving a refresh: the same key replays the first
  // order if the response was lost, instead of placing a second one.
  const idempotencyKey = useRef<string | null>(null);

  const cart = cartQuery.data;
  const items = cart?.items ?? [];
  const addresses = addressesQuery.data ?? [];
  const defaultAddress =
    addresses.find((address) => address.defaultShipping) ?? addresses[0] ?? null;

  const selectedAddress =
    order?.address ?? addresses.find((address) => address.id === addressId) ?? null;
  const total = order?.totalPrice ?? cart?.grandTotal ?? 0;

  const lines: SummaryLine[] = order
    ? (order.items ?? []).map((item, index) => ({
        key: `${item.variantId ?? item.productId}-${index}`,
        name: item.productName,
        image: item.productImage,
        variant: [item.variantColorName, item.variantSize].filter(Boolean).join(" · "),
        quantity: item.quantity,
        amount: item.subTotal,
      }))
    : items.map((item) => ({
        key: String(item.id),
        name: item.productName,
        image: item.productImage,
        variant: [item.variantColorName, item.variantSize].filter(Boolean).join(" · "),
        quantity: item.quantity,
        amount: item.lineTotal,
      }));

  const initialContact: ContactValues = {
    email: user?.email ?? "",
    name: contact?.name ?? defaultAddress?.recipientName ?? "",
    phone: contact?.phone ?? defaultAddress?.phone ?? "",
  };

  const busy = placing || payingFor !== null;

  async function onPay() {
    setPayError(null);
    setPayNotice(null);
    let current = order;

    if (!current) {
      if (addressId == null) {
        setPayError("Choose a delivery address before paying.");
        return;
      }
      const key = (idempotencyKey.current ??= newKey());
      setPlacing(true);
      try {
        const { data, error, response } = await api.POST("/api/v1/cart/checkout", {
          params: { header: { "Idempotency-Key": key } },
          // The server builds the lines from the cart; orderItems is only here because the
          // generated request type is shared with the direct-order endpoint.
          body: { orderItems: [], addressId },
        });
        if (!response.ok || !data?.data) {
          setPayError(toAuthFailure(response.status, error ?? null).message);
          return;
        }
        current = data.data;
        setOrder(current);
        idempotencyKey.current = null;
        queryClient.setQueryData<Cart | undefined>(CART_KEY, (cached) =>
          cached ? { ...cached, items: [], itemCount: 0, grandTotal: 0 } : cached,
        );
        void queryClient.invalidateQueries({ queryKey: CART_KEY });
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
      } catch {
        setPayError("Could not reach the store. Your bag is unchanged — try again.");
        return;
      } finally {
        setPlacing(false);
      }
    }

    const result = await pay(current.id!, {
      name: contact?.name ?? selectedAddress?.recipientName,
      email: contact?.email ?? user?.email,
      contact: contact?.phone ?? selectedAddress?.phone,
    });

    if (result.status === "paid") {
      toast.success("Payment captured");
      router.push(`/orders/${result.orderId}?paid=1`);
      return;
    }
    if (result.status === "dismissed") {
      setPayNotice(
        `Order #${result.orderId} is saved. You can finish payment from your orders at any time.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["order", result.orderId] });
      return;
    }
    setPayError(result.message);
  }

  if (cartQuery.isPending || addressesQuery.isPending) return <CheckoutSkeleton />;

  if (cartQuery.isError) {
    return (
      <div className="border-y py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {cartQuery.error instanceof HttpError
            ? cartQuery.error.message
            : "Could not load your bag."}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => cartQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!order && items.length === 0) {
    return (
      <div className="space-y-8">
        <CheckoutHeading />
        <EmptyState
          title="Nothing to check out"
          description="Your bag is empty. Add a piece or two and come back — your address book is already waiting."
          action={{ label: "Browse the collection", href: "/products" }}
        />
      </div>
    );
  }

  return (
    <>
      <RazorpayScript />
      <div className="space-y-8">
        <CheckoutHeading />

        <ol aria-label="Checkout steps" className="flex flex-wrap items-center gap-x-8 gap-y-2 border-y py-4">
          {STEPS.map((entry) => {
            const active = entry.number === step;
            const done = entry.number < step || order != null;
            return (
              <li key={entry.number} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-[10px] tabular-nums",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : done
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {done && !active ? "✓" : entry.number}
                </span>
                <span className={cn("label-caps", active ? "text-foreground" : "text-muted-foreground")}>
                  {entry.label}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div>
            {step === 1 ? (
              <ContactStep
                initial={initialContact}
                onContinue={(values) => {
                  setContact(values);
                  setStep(2);
                }}
              />
            ) : null}

            {step === 2 ? (
              <DeliveryStep
                addresses={addresses}
                initialAddressId={addressId}
                contact={contact ?? initialContact}
                onBack={() => setStep(1)}
                onContinue={(id) => {
                  setAddressId(id);
                  setPayError(null);
                  setStep(3);
                }}
              />
            ) : null}

            {step === 3 ? (
              <PaymentStep
                order={order}
                address={selectedAddress}
                total={total}
                busy={busy}
                notice={payNotice}
                error={payError}
                onPay={onPay}
                onBack={() => setStep(2)}
              />
            ) : null}
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <CheckoutSummary lines={lines} total={total} />
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Free delivery on every order · 3–5 working days
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function CheckoutHeading() {
  return (
    <header>
      <p className="label-caps text-muted-foreground">Checkout</p>
      <h1 className="mt-2 text-2xl md:text-3xl">Almost yours</h1>
    </header>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
