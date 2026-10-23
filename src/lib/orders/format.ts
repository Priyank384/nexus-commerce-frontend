import type { components } from "@/lib/api/schema";

type RawOrder = components["schemas"]["GetOrderResponseDto"];
export type OrderStatus = NonNullable<RawOrder["orderStatus"]>;
export type PaymentStatus = NonNullable<RawOrder["paymentStatus"]>;

/**
 * An order that never reached the gateway comes back with `paymentStatus: null`, but the
 * generated schema only lists the enum. Widening here keeps the null state honest until the
 * DTO is annotated nullable upstream.
 */
export type Order = Omit<RawOrder, "paymentStatus"> & {
  paymentStatus?: PaymentStatus | null;
};

export type OrderItem = components["schemas"]["OrderItemResponseDto"];

type BadgeTone = "default" | "secondary" | "destructive" | "outline";

const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Processing", tone: "outline" },
  SHIPPED: { label: "Shipped", tone: "secondary" },
  DELIVERED: { label: "Delivered", tone: "default" },
  CANCELLED: { label: "Cancelled", tone: "destructive" },
};

/** Null is a real state: the order exists but checkout never reached the gateway. */
const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  CREATED: { label: "Payment pending", tone: "outline" },
  PAID: { label: "Payment captured", tone: "default" },
  FAILED: { label: "Payment failed", tone: "destructive" },
};

export function orderStatus(status: OrderStatus | undefined) {
  return status ? ORDER_STATUS[status] : { label: "Unknown", tone: "outline" as BadgeTone };
}

export function paymentStatus(status: PaymentStatus | null | undefined) {
  return status ? PAYMENT_STATUS[status] : { label: "Awaiting payment", tone: "outline" as BadgeTone };
}

export function canPay(order: Order): boolean {
  return order.paymentStatus !== "PAID" && order.orderStatus !== "CANCELLED";
}

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatOrderDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

export function variantLabel(item: OrderItem): string {
  return [item.variantColorName, item.variantSize].filter(Boolean).join(" · ");
}

export function itemCount(order: Order): number {
  return (order.items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0);
}
