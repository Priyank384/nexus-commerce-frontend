"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/**
 * Route-level boundary: a render or data error in any page keeps the shop header and
 * footer, so the visitor can retry or move on instead of staring at Next's dev overlay
 * (or a blank screen in production).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error:", error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <p className="label-caps text-muted-foreground">Something went wrong</p>
      <h1 className="text-2xl">We couldn&apos;t load this page</h1>
      <p className="text-sm text-muted-foreground">
        The shop may be briefly unreachable. Try again, or head back to the collection.
      </p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className={buttonVariants()}>
          Try again
        </button>
        <Link href="/products" className={buttonVariants({ variant: "outline" })}>
          Shop the collection
        </Link>
      </div>
    </div>
  );
}
