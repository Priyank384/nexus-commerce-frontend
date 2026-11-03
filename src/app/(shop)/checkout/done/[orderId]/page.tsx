import { Suspense } from "react";
import { GuestReceipt } from "@/components/checkout/guest-receipt";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Order confirmed" };
export const instant = false;

export default function GuestReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl space-y-8">
          <div className="space-y-4 border p-10 text-center">
            <Skeleton className="mx-auto size-8 rounded-full" />
            <Skeleton className="mx-auto h-8 w-64" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      }
    >
      <GuestReceipt />
    </Suspense>
  );
}
