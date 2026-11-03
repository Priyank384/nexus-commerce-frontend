"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileQuery, useUpdateProfile } from "@/lib/account/queries";
import { HttpError } from "@/lib/api/errors";
import type { ProfileValues } from "@/lib/validation/account";
import { ChangePasswordPanel } from "./change-password-panel";
import { ProfileForm } from "./profile-form";

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
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);

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

  async function save(values: ProfileValues) {
    try {
      await update.mutateAsync({ name: values.name, phone: values.phone.trim() || undefined });
      setEditing(false);
      toast.success("Details saved");
    } catch (error) {
      toast.error(error instanceof HttpError ? error.message : "Could not save your details.");
    }
  }

  return (
    <div className="max-w-xl space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-lg">Your details</h2>
          {editing ? null : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <ProfileForm
            defaultValues={{ name: user.name ?? "", phone: user.phone ?? "" }}
            submitLabel="Save changes"
            pending={update.isPending}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-6 border-b pb-3">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="text-right">{user.name}</dd>
              </div>
              <div className="flex justify-between gap-6 border-b pb-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-right">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-6 border-b pb-3">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="text-right">{user.phone || "Not given"}</dd>
              </div>
              {since ? (
                <div className="flex justify-between gap-6 border-b pb-3">
                  <dt className="text-muted-foreground">Customer since</dt>
                  <dd className="text-right">{since}</dd>
                </div>
              ) : null}
            </dl>

            {/* Email is the login identity and every order points at it, so it is shown rather
                than offered for editing — changing it needs a verified flow, not a text box. */}
            <p className="text-xs leading-5 text-muted-foreground">
              Your email is how you sign in and cannot be changed here. Use a different address
              when you register if this one no longer reaches you.
            </p>
          </>
        )}
      </section>

      <ChangePasswordPanel email={user.email ?? ""} />

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
