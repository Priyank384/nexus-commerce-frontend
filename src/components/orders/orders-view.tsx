"use client";

import Image from "next/image";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/lib/api/client";
import { HttpError, toAuthFailure } from "@/lib/api/errors";
import type { components } from "@/lib/api/schema";
import { formatPrice } from "@/lib/catalog/format";
import {
  formatOrderDate,
  itemCount,
  orderStatus,
  paymentStatus,
  type Order,
} from "@/lib/orders/format";

type OrdersPage = components["schemas"]["PageResponseGetOrderResponseDto"];

async function fetchOrders(page: number): Promise<OrdersPage> {
  const { data, error, response } = await api.GET("/api/v1/orders/me", {
    params: { query: { page, size: 20 } },
  });
  if (!response.ok || !data?.data) {
    throw new HttpError(response.status, toAuthFailure(response.status, error ?? null).message);
  }
  return data.data;
}

export function OrdersView() {
  const { data, isPending, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["orders"],
      initialPageParam: 0,
      queryFn: ({ pageParam }) => fetchOrders(pageParam),
      getNextPageParam: (lastPage) => (lastPage.last ? undefined : (lastPage.page ?? 0) + 1),
    });

  if (isPending) return <OrdersSkeleton />;

  if (isError) {
    return (
      <div className="border-y py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {error instanceof HttpError ? error.message : "Could not load your orders."}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const orders = data.pages.flatMap((page) => page.content ?? []);

  return (
    <div className="space-y-8">
      <header>
        <p className="label-caps text-muted-foreground">Account</p>
        <h1 className="mt-2 text-2xl md:text-3xl">Orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything you have ordered, newest first.
        </p>
      </header>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When you place an order it will appear here with its delivery address and payment status."
          action={{ label: "Browse the collection", href: "/products" }}
        />
      ) : (
        <>
          <ul className="divide-y border-y">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
          {hasNextPage ? (
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading…" : "Load more orders"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const status = orderStatus(order.orderStatus);
  const payment = paymentStatus(order.paymentStatus);
  const items = order.items ?? [];
  const count = itemCount(order);

  return (
    <li>
      <Link
        href={`/orders/${order.id}`}
        className="grid gap-4 py-5 transition-colors hover:bg-muted/30 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-6"
      >
        <div className="flex -space-x-2">
          {items.slice(0, 3).map((item, index) => (
            <div
              key={`${item.variantId ?? item.productId}-${index}`}
              className="relative aspect-[4/5] w-12 shrink-0 overflow-hidden border bg-muted"
            >
              {item.productImage ? (
                <Image src={item.productImage} alt="" fill sizes="48px" className="object-cover" />
              ) : null}
            </div>
          ))}
          {items.length > 3 ? (
            <span className="flex aspect-[4/5] w-12 items-center justify-center border bg-background text-xs text-muted-foreground">
              +{items.length - 3}
            </span>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-sm">Order #{order.id}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatOrderDate(order.createdAt)} · {count === 1 ? "1 item" : `${count} items`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={status.tone}>{status.label}</Badge>
            <Badge variant={payment.tone}>{payment.label}</Badge>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <p className="text-sm tabular-nums">{formatPrice(order.totalPrice)}</p>
          <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
        </div>
      </Link>
    </li>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="divide-y border-y">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-6 py-5">
            <Skeleton className="aspect-[4/5] w-16" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
