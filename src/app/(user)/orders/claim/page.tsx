import { Suspense } from "react";
import { ClaimView } from "@/components/orders/claim-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Claim an order",
  description: "Move an order placed without an account into your order history.",
  robots: { index: false, follow: false },
};

export const instant = false;

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-20 w-full" />
        </div>
      }
    >
      <ClaimView />
    </Suspense>
  );
}
