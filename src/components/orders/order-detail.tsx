"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/session";
import { formatPrice } from "@/lib/catalog/format";
import {
  canPay,
  formatOrderDate,
  orderStatus,
  paymentStatus,
  variantLabel,
  type Order,
} from "@/lib/orders/format";
import { cn } from "@/lib/utils";
import { AddressSummary } from "@/components/checkout/summary";
import { RazorpayScript } from "@/components/checkout/razorpay";
import { usePayOrder } from "@/components/checkout/use-pay-order";

async function fetchOrder(id: number): Promise<Order> {
  const { data, error, response } = await api.GET("/api/v1/orders/{id}", {
    params: { path: { id } },
  });
  if (!response.ok || !data?.data) {
    throw new HttpError(response.status, toAuthFailure(response.status, error ?? null).message);
  }
  return data.data;
}

export function OrderDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = Number(params?.id);
  const user = useSession((state) => state.user);
  const { pay, payingFor } = usePayOrder();

  const { data: order, isPending, isError, error, refetch } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrder(id),
    enabled: Number.isInteger(id) && id > 0,
  });

  if (!Number.isInteger(id) || id <= 0) {
    return <NotFound />;
  }

  if (isPending) return <OrderSkeleton />;

  if (isError || !order) {
    const status = error instanceof HttpError ? error.status : 0;
    if (status === 404 || status === 403) return <NotFound />;
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

  const status = orderStatus(order.orderStatus);
  const payment = paymentStatus(order.paymentStatus);
  const justPaid = searchParams.get("paid") === "1" && order.paymentStatus === "PAID";
  const items = order.items ?? [];
  const subtotal = items.reduce((sum, item) => sum + (item.subTotal ?? 0), 0);
  // Admins can open any order here; only the shopper who owns it may settle it.
  const payable = canPay(order) && order.userId === user?.id;

  async function onPay() {
    if (!order) return;
    const result = await pay(order.id!, {
      name: order.address?.recipientName,
      email: user?.email,
      contact: order.address?.phone,
    });
    if (result.status === "paid") {
      toast.success("Payment captured");
      router.replace(`/orders/${order.id}?paid=1`);
      return;
    }
    if (result.status === "dismissed") {
      toast("Payment window closed — the order is still pending.");
      return;
    }
    toast.error(result.message);
  }

  return (
    <>
      <RazorpayScript />
      <div className="space-y-8">
        <nav aria-label="Breadcrumb" className="label-caps text-muted-foreground">
          <Link href="/orders" className="hover:text-foreground">
            Orders
          </Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">#{order.id}</span>
        </nav>

        {justPaid ? (
          <div className="flex items-start gap-3 border border-foreground/20 bg-muted/40 p-4">
            <CheckCircle2 aria-hidden className="mt-0.5 size-5" />
            <div>
              <p className="text-sm font-medium">Payment captured</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Thank you — we will email you when your order ships.
              </p>
            </div>
          </div>
        ) : null}

        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-caps text-muted-foreground">Order</p>
            <h1 className="mt-2 text-2xl md:text-3xl">#{order.id}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Placed {formatOrderDate(order.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={status.tone}>{status.label}</Badge>
            <Badge variant={payment.tone}>{payment.label}</Badge>
          </div>
        </header>

        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div className="space-y-10">
            <section aria-labelledby="items-heading">
              <h2 id="items-heading" className="label-caps text-muted-foreground">
                Items
              </h2>
              <ul className="mt-4 divide-y border-y">
                {items.map((item, index) => (
                  <li key={`${item.variantId ?? item.productId}-${index}`} className="flex gap-4 py-4">
                    <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-muted sm:w-20">
                      {item.productImage ? (
                        <Image
                          src={item.productImage}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 80px, 64px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{item.productName}</p>
                        <p className="label-caps mt-1.5 text-muted-foreground">
                          {variantLabel(item) || "One size"}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {item.quantity} × {formatPrice(item.productPrice)}
                        </p>
                      </div>
                      <p className="text-sm tabular-nums">{formatPrice(item.subTotal)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="address-heading">
              <h2 id="address-heading" className="label-caps text-muted-foreground">
                Shipping address
              </h2>
              <div className="mt-4 border p-4">
                {order.address ? (
                  <AddressSummary address={order.address} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This order was placed before addresses were captured.
                  </p>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="border p-6">
              <h2 className="label-caps text-muted-foreground">Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Delivery</dt>
                  <dd>Free</dd>
                </div>
                <div className="flex justify-between border-t pt-3 text-base">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatPrice(order.totalPrice)}</dd>
                </div>
              </dl>
              <p className="mt-1.5 text-xs text-muted-foreground">Prices include all taxes.</p>
            </div>

            <div className="border p-6">
              <h2 className="label-caps text-muted-foreground">Payment</h2>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Badge variant={payment.tone}>{payment.label}</Badge>
                {order.paidAt ? (
                  <span className="text-xs text-muted-foreground">
                    {formatOrderDate(order.paidAt)}
                  </span>
                ) : null}
              </div>
              {payable ? (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">
                    This order is saved but not paid. You can complete payment now.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full"
                    onClick={onPay}
                    disabled={payingFor !== null}
                  >
                    {payingFor !== null
                      ? "Opening payment…"
                      : `Pay ${formatPrice(order.totalPrice)}`}
                  </Button>
                </>
              ) : order.paymentStatus === "PAID" ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Paid in full. We will email you as it moves through dispatch.
                </p>
              ) : null}
            </div>

            <Link
              href="/orders"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              All orders
            </Link>
          </aside>
        </div>
      </div>
    </>
  );
}

function NotFound() {
  return (
    <div className="space-y-6 border-y py-16 text-center">
      <h1 className="text-xl">Order not found</h1>
      <p className="text-sm text-muted-foreground">
        It may have been removed, or it belongs to another account.
      </p>
      <Link href="/orders" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Back to orders
      </Link>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-4 w-28" />
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
