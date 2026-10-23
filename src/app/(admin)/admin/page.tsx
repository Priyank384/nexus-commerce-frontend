"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminMetrics, type AdminMetrics } from "@/lib/admin/queries";
import { formatPrice } from "@/lib/catalog/format";

const STATUSES = ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

const count = new Intl.NumberFormat("en-IN");

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-0 py-5">
      <CardHeader className="pb-2">
        <CardTitle role="heading" aria-level={2} className="label-caps text-muted-foreground font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-3xl tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Pipeline({ metrics }: { metrics: AdminMetrics }) {
  const counts = STATUSES.map((status) => metrics.ordersByStatus?.[status] ?? 0);
  const max = Math.max(...counts, 1);

  return (
    <Card className="gap-0 py-5">
      <CardHeader className="pb-4">
        <CardTitle role="heading" aria-level={2} className="font-heading text-base font-medium">Order pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {STATUSES.map((status, index) => {
          const value = counts[index];
          return (
            <div key={status} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3">
              <span className="label-caps text-muted-foreground">{status}</span>
              <span
                className="h-1.5 rounded-full bg-foreground/15"
                role="img"
                aria-label={`${status}: ${value} orders`}
              >
                <span
                  className="block h-full rounded-full bg-foreground/70"
                  style={{ width: `${(value / max) * 100}%` }}
                />
              </span>
              <span className="text-right text-sm tabular-nums">{count.format(value)}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { data, isPending, isError, error, refetch } = useAdminMetrics();

  if (isPending) {
    return (
      <section aria-label="Loading dashboard" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>The dashboard could not be loaded</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Please try again."}
        </AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything the store holds and has sold, at a glance.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Revenue"
          value={formatPrice(data.totalRevenue)}
          hint="Paid and pending line items, at snapshot prices"
        />
        <Stat label="Orders" value={count.format(data.totalOrders ?? 0)} />
        <Stat label="Customers" value={count.format(data.totalUsers ?? 0)} />
        <Stat label="Products" value={count.format(data.totalProducts ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Pipeline metrics={data} />

        <div className="grid gap-4">
          <Card className="gap-0 py-5">
            <CardHeader className="pb-3">
              <CardTitle role="heading" aria-level={2} className="font-heading text-base font-medium">Stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Out of stock</span>
                <span className="text-lg tabular-nums">{count.format(data.outOfStockProducts ?? 0)}</span>
              </p>
              <Link
                href="/admin/inventory"
                className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
              >
                Review inventory
              </Link>
            </CardContent>
          </Card>

          <Card className="gap-0 py-5">
            <CardHeader className="pb-3">
              <CardTitle role="heading" aria-level={2} className="font-heading text-base font-medium">Catalogue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Categories</span>
                <span className="tabular-nums">{count.format(data.totalCategories ?? 0)}</span>
              </p>
              <p className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Reviews</span>
                <span className="tabular-nums">{count.format(data.totalReviews ?? 0)}</span>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
