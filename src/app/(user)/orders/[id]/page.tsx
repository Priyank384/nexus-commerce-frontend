import { Suspense } from "react";
import { OrderDetail } from "@/components/orders/order-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Order" };
export const instant = false;

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <OrderDetail />
    </Suspense>
  );
}
