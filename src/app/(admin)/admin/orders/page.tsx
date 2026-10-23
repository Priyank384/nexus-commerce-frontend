"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  nextOrderActions,
  useAdminOrders,
  useUpdateOrderStatus,
  type AdminOrder,
  type AdminOrderStatus,
} from "@/lib/admin/orders";
import { formatPrice } from "@/lib/catalog/format";
import {
  formatOrderDate,
  itemCount,
  orderStatus,
  paymentStatus,
  variantLabel,
} from "@/lib/orders/format";
import { toast } from "sonner";

function StatusButton({ order, next, label }: { order: AdminOrder; next: AdminOrderStatus; label: string }) {
  const update = useUpdateOrderStatus(order.id!);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={update.isPending}
      onClick={() =>
        update.mutate(next, {
          onSuccess: () => toast.success(`Order #${order.id} ${label.toLowerCase()}`),
          onError: (error) => toast.error(error.message),
        })
      }
    >
      {update.isPending ? "Saving…" : label}
    </Button>
  );
}

/**
 * Cancelling is the one destructive move left on a paid order: the money already left the
 * customer, so the dialog has to say that this screen cannot give it back.
 */
function CancelOrder({ order }: { order: AdminOrder }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateOrderStatus(order.id!);
  const paid = order.paymentStatus === "PAID";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />
        }
      >
        Cancel
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order #{order.id}?</DialogTitle>
          <DialogDescription>
            Every line&rsquo;s quantity goes back into stock and the order moves to Cancelled. This
            cannot be undone.
            {paid
              ? " The payment was captured — cancelling does not refund it. Issue the refund in Razorpay yourself."
              : " No payment was captured, so there is nothing to refund."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Keep order</DialogClose>
          <Button
            variant="destructive"
            disabled={update.isPending}
            onClick={() =>
              update.mutate("CANCELLED", {
                onSuccess: () => {
                  setOpen(false);
                  toast.success(`Order #${order.id} cancelled`);
                },
                onError: (error) => toast.error(error.message),
              })
            }
          >
            {update.isPending ? "Cancelling…" : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Actions({ order }: { order: AdminOrder }) {
  const actions = nextOrderActions(order.orderStatus ?? "PENDING");
  const cancellable = order.orderStatus === "PENDING";

  if (actions.length === 0 && !cancellable) {
    return <span className="text-xs text-muted-foreground">No actions</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.map((action) => (
        <StatusButton
          key={action.next}
          order={order}
          next={action.next}
          label={action.label}
        />
      ))}
      {cancellable ? <CancelOrder order={order} /> : null}
    </div>
  );
}

function OrdersTable({ orders }: { orders: AdminOrder[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead className="hidden lg:table-cell">Customer</TableHead>
          <TableHead className="hidden md:table-cell">Items</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Payment</TableHead>
          <TableHead className="w-56 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const status = orderStatus(order.orderStatus);
          const payment = paymentStatus(order.paymentStatus);
          const items = order.items ?? [];

          return (
            <TableRow key={order.id}>
              <TableCell>
                <Link
                  href={`/orders/${order.id}`}
                  className="text-sm underline-offset-4 hover:underline"
                >
                  #{order.id}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatOrderDate(order.createdAt)}
                </p>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <p className="text-sm">{order.customerName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{order.customerEmail ?? "—"}</p>
              </TableCell>
              <TableCell className="hidden max-w-56 md:table-cell">
                <p className="text-sm">
                  {itemCount(order) === 1 ? "1 item" : `${itemCount(order)} items`}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {items
                    .map((item) =>
                      [item.productName, variantLabel(item)].filter(Boolean).join(" · "),
                    )
                    .join(", ") || "—"}
                </p>
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatPrice(order.totalPrice)}
              </TableCell>
              <TableCell>
                <Badge variant={status.tone}>{status.label}</Badge>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant={payment.tone}>{payment.label}</Badge>
              </TableCell>
              <TableCell className="text-right">
                <Actions order={order} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function AdminOrdersPage() {
  const [page, setPage] = useState(0);
  const { data, isPending, isError, error, refetch } = useAdminOrders(page);
  const orders = data?.content ?? [];
  const total = data?.totalElements ?? 0;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-3xl tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total ? `${total} orders, newest first` : "Every order, newest first."}
        </p>
      </header>

      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTitle>Orders could not be loaded</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : "Please try again."}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      ) : orders.length === 0 ? (
        <div className="border border-dashed px-6 py-16 text-center">
          <p className="font-heading text-lg">No orders yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders appear here as soon as a shopper checks out.
          </p>
        </div>
      ) : (
        <OrdersTable orders={orders} />
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          Page {(data?.page ?? 0) + 1} of {Math.max(data?.totalPages ?? 1, 1)}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data?.last ?? true}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
