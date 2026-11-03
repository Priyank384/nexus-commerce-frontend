"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/auth";
import { useHydrated } from "@/lib/use-hydrated";
import { toAuthFailure, type ApiEnvelope } from "@/lib/api/errors";

/**
 * Sets a new password with the token from the emailed link.
 *
 * The token is what the whole flow turns on: it works once, so a submit that the server rejects
 * as a bad link must not leave the shopper staring at the same form, convinced they typed the
 * password wrong. That branch is a dead link and has to say so.
 */
function ResetPasswordFormInner() {
  const searchParams = useSearchParams();
  // Read once and kept out of the DOM: the token is a live credential, and the URL already holds
  // it long enough for the email reader who pasted it.
  const [token] = useState(() => searchParams.get("token")?.trim() ?? "");
  const [done, setDone] = useState(false);
  const [deadLink, setDeadLink] = useState<string | null>(null);
  const [serverAlert, setServerAlert] = useState<string | null>(null);
  const interactive = useHydrated();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordValues) {
    setServerAlert(null);

    let res: Response;
    try {
      res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password: values.password }),
      });
    } catch {
      setServerAlert("Could not reach the store. Try again in a moment.");
      return;
    }

    const body = (await res.json().catch(() => null)) as ApiEnvelope<null> | null;

    if (!res.ok) {
      const failure = toAuthFailure(res.status, body);
      // A rejected token is not a retryable glitch — spending is what the server does with a link
      // it does not accept, so the only way forward is a fresh one.
      if (res.status === 400 || res.status === 401 || res.status === 404) {
        setDeadLink(failure.message);
        return;
      }
      setServerAlert(failure.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <CheckCircle2 aria-hidden className="size-8 text-muted-foreground" />
        <h1 className="mt-3 text-2xl">New password set</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every other device signed into this account has been signed out. Sign in here with the
          password you just chose.
        </p>
        <Link href="/login" className={cn(buttonVariants({ size: "sm" }), "mt-6")}>
          Sign in
        </Link>
      </div>
    );
  }

  if (!token || deadLink) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold">This link will not work</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {deadLink
            ? deadLink
            : "Reset links carry a one-time token. If you copied the address by hand, the link may be cut short."}
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ask for a fresh link — the old one stops working either way.
        </p>
        <Link href="/forgot-password" className={cn(buttonVariants({ size: "sm" }), "mt-2")}>
          Send a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Choose a new password</h1>
      {serverAlert && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{serverAlert}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : "password-hint"}
            {...register("password")}
          />
          {errors.password ? (
            <p id="password-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.password.message}
            </p>
          ) : (
            <p id="password-hint" className="mt-1 text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p id="confirm-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={!interactive || isSubmitting}>
          {isSubmitting ? "Setting…" : "Set new password"}
        </Button>
      </form>

      <p className="text-sm mt-4 text-muted-foreground">
        Changed your mind?{" "}
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
