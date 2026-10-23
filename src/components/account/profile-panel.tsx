"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileQuery } from "@/lib/account/queries";

function memberSince(value: string | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ProfilePanel() {
  const profile = useProfileQuery();

  if (profile.isPending) {
    return <Skeleton className="h-52 w-full max-w-xl" />;
  }

  if (profile.isError) {
    return (
      <div className="max-w-xl space-y-4 text-sm">
        <p role="alert" className="text-muted-foreground">
          We could not load your profile.
        </p>
        <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => profile.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const user = profile.data;
  const since = memberSince(user.createdAt);

  return (
    <div className="max-w-xl space-y-8">
      <dl className="space-y-3 text-sm">
        <div className="flex justify-between gap-6 border-b pb-3">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="text-right">{user.name}</dd>
        </div>
        <div className="flex justify-between gap-6 border-b pb-3">
          <dt className="text-muted-foreground">Email</dt>
          <dd className="text-right">{user.email}</dd>
        </div>
        {user.phone ? (
          <div className="flex justify-between gap-6 border-b pb-3">
            <dt className="text-muted-foreground">Phone</dt>
            <dd className="text-right">{user.phone}</dd>
          </div>
        ) : null}
        {since ? (
          <div className="flex justify-between gap-6 border-b pb-3">
            <dt className="text-muted-foreground">Customer since</dt>
            <dd className="text-right">{since}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link href="/orders" className={buttonVariants({ variant: "outline" })}>
          View orders
        </Link>
        <Link href="/products" className={buttonVariants({ variant: "ghost" })}>
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
