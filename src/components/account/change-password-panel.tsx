"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { signedOut } from "@/lib/api/client";
import { clearQueryCache } from "@/lib/query/client";
import { useChangePassword } from "@/lib/account/queries";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/validation/account";
import { HttpError } from "@/lib/api/errors";

const EMPTY: ChangePasswordValues = { currentPassword: "", newPassword: "", confirmPassword: "" };

/**
 * Changes the password from inside the account, for a shopper who can still sign in.
 *
 * The endpoint proves the current password before accepting a new one, then revokes every
 * refresh token on the account — including this browser's. So the form has to re-establish the
 * session it just invalidated, and say plainly that other devices are now signed out.
 */
export function ChangePasswordPanel({ email }: { email: string }) {
  const router = useRouter();
  const change = useChangePassword();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  async function onSubmit(values: ChangePasswordValues) {
    try {
      const reauthed = await change.mutateAsync({ ...values, email });
      reset(EMPTY);
      if (reauthed) {
        toast.success("Password changed");
        return;
      }
      // The change landed but this session could not be re-minted, so nothing here is signed in
      // any more. Clearing the local state is the honest answer; leaving it would let the header
      // keep greeting the shopper while every request behind it 401s.
      signedOut();
      clearQueryCache();
      toast.message("Password changed. Please sign in again.");
      router.push("/login");
    } catch (error) {
      // Not rendering the message would leave the shopper guessing which field they got wrong.
      toast.error(error instanceof HttpError ? error.message : "Could not change the password.");
    }
  }

  return (
    <section className="max-w-xl space-y-4">
      <div>
        <h2 className="text-lg">Password</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Changing it signs every other device out of this account. This one stays signed in.
        </p>
      </div>

      {change.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {change.error instanceof HttpError
              ? change.error.message
              : "Could not change the password. Try again."}
          </AlertDescription>
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="acct-current-password">Current password</Label>
          <Input
            id="acct-current-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            aria-describedby={errors.currentPassword ? "acct-current-password-error" : undefined}
            {...register("currentPassword")}
          />
          {errors.currentPassword ? (
            <p
              id="acct-current-password-error"
              role="alert"
              className="mt-1 text-sm text-destructive"
            >
              {errors.currentPassword.message}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="acct-new-password">New password</Label>
          <Input
            id="acct-new-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.newPassword)}
            aria-describedby={errors.newPassword ? "acct-new-password-error" : "acct-new-password-hint"}
            {...register("newPassword")}
          />
          {errors.newPassword ? (
            <p id="acct-new-password-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.newPassword.message}
            </p>
          ) : (
            <p id="acct-new-password-hint" className="mt-1 text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="acct-confirm-password">Confirm new password</Label>
          <Input
            id="acct-confirm-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? "acct-confirm-password-error" : undefined
            }
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p
              id="acct-confirm-password-error"
              role="alert"
              className="mt-1 text-sm text-destructive"
            >
              {errors.confirmPassword.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="outline" disabled={change.isPending}>
          {change.isPending ? "Changing…" : "Change password"}
        </Button>
      </form>
    </section>
  );
}
