"use client";

import { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginSchema, type LoginValues } from "@/lib/validation/auth";
import { useSession } from "@/lib/auth/session";
import { toAuthFailure, type ApiEnvelope } from "@/lib/api/errors";

// Reads `?next=` so the guards in (user)/(admin) can bounce back after login.
function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = sanitizeNext(params.get("next"));
  const [serverAlert, setServerAlert] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const set = useSession((s) => s.set);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setServerAlert(null);
    if (lockedUntil && lockedUntil > Date.now()) {
      setServerAlert("You are rate-limited. Wait until the countdown finishes.");
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
    } catch {
      setServerAlert("Backend unreachable. Is Spring running on :3001?");
      return;
    }

    const body = (await res.json().catch(() => null)) as ApiEnvelope<{ token?: string }> | null;

    if (!res.ok) {
      const failure = toAuthFailure(res.status, body);
      if (failure.kind === "rate_limited") {
        // Backend rate limit is a fixed 1-minute window per IP. Show only the
        // countdown so the UI isn't repeating itself.
        setLockedUntil(Date.now() + 60_000);
        return;
      }
      setServerAlert(failure.message);
      return;
    }

    const token = body?.data?.token;
    if (!token) {
      setServerAlert("Login succeeded but no token came back. Check the BFF.");
      return;
    }
    set(token);
    toast.success("Signed in");
    router.replace(next);
  }

  return (
    <div className="max-w-sm mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Log in</h1>
      {serverAlert && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{serverAlert}</AlertDescription>
        </Alert>
      )}
      {lockedUntil && <RateLimitCountdown until={lockedUntil} onExpire={() => setLockedUntil(null)} />}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Log in"}
        </Button>
      </form>

      <p className="text-sm mt-4 text-muted-foreground">
        No account?{" "}
        <Link href="/register" className="underline">
          Register
        </Link>
      </p>
    </div>
  );
}

function RateLimitCountdown({ until, onExpire }: { until: number; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= until) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until, onExpire]);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <p className="text-sm text-amber-600 mb-3">
      Too many attempts — retry in <span className="tabular-nums font-medium">{seconds}s</span>
    </p>
  );
}

// Only allow same-origin paths so we never redirect off-site.
function sanitizeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
