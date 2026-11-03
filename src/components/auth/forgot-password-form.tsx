"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/auth";
import { sanitizeNext, nextHref } from "@/lib/auth/next-path";
import { useHydrated } from "@/lib/use-hydrated";
import { toAuthFailure, type ApiEnvelope } from "@/lib/api/errors";
import { RATE_LIMIT_WINDOW_SECONDS, RateLimitCountdown } from "./rate-limit-countdown";

/**
 * The way back into an account for a shopper who cannot log in.
 *
 * Nothing here may confirm whether the address is registered. The endpoint answers the same way
 * for both, so this form has to keep answering the same way too — a "no account found" branch, or
 * a button that only works for real addresses, is a shopper list for anyone who asks.
 */
function ForgotPasswordFormInner() {
  const next = sanitizeNext(useSearchParams().get("next"));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [serverAlert, setServerAlert] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const interactive = useHydrated();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordValues) {
    setServerAlert(null);
    if (lockoutSeconds) {
      setServerAlert("You are rate-limited. Wait until the countdown finishes.");
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: values.email }),
      });
    } catch {
      setServerAlert("Could not reach the store. Try again in a moment.");
      return;
    }

    const body = (await res.json().catch(() => null)) as ApiEnvelope<null> | null;

    if (!res.ok) {
      const failure = toAuthFailure(res.status, body);
      if (failure.kind === "rate_limited") {
        setLockoutSeconds(RATE_LIMIT_WINDOW_SECONDS);
        return;
      }
      setServerAlert(failure.message);
      return;
    }

    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="mx-auto w-full max-w-sm">
        <CheckCircle2 aria-hidden className="size-8 text-muted-foreground" />
        <h1 className="mt-3 text-2xl">Check {sentTo}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          If that address has an account, a link to choose a new password is on its way. It works
          once and expires in fifteen minutes.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Nothing arrives? The address may not be the one on the account — try again, or go back
          and sign in.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={nextHref("/login", next)} className="underline text-sm">
            Back to sign in
          </Link>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setSentTo(null);
              setServerAlert(null);
            }}
          >
            Send to a different address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Forgot password</h1>
      {serverAlert && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{serverAlert}</AlertDescription>
        </Alert>
      )}
      {lockoutSeconds != null && (
        <RateLimitCountdown
          seconds={lockoutSeconds}
          onExpire={() => setLockoutSeconds(null)}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="mt-1 text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={!interactive || isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="text-sm mt-4 text-muted-foreground">
        Remembered it?{" "}
        <Link href={nextHref("/login", next)} className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordFormInner />
    </Suspense>
  );
}
