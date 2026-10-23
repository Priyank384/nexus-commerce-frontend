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
import { useHydrated } from "@/lib/use-hydrated";
import { toAuthFailure, type ApiEnvelope } from "@/lib/api/errors";

// Reads `?next=` so the guards in (user)/(admin) can bounce back after login.
const RATE_LIMIT_WINDOW_SECONDS = 60;

function LoginFormInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = sanitizeNext(params.get("next"));
  const [serverAlert, setServerAlert] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  // See RegisterForm: a pre-hydration click must not become a native GET with the
  // password in the query string.
  const interactive = useHydrated();
  const set = useSession((s) => s.set);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setServerAlert(null);
    if (lockoutSeconds) {
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
        setLockoutSeconds(RATE_LIMIT_WINDOW_SECONDS);
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
      {lockoutSeconds != null && (
        <RateLimitCountdown seconds={lockoutSeconds} onExpire={() => setLockoutSeconds(null)} />
      )}

      <form onSubmit={handleSubmit(onSubmit)} method="post" className="space-y-4">
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
        <Button type="submit" className="w-full" disabled={!interactive || isSubmitting}>
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

function RateLimitCountdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0) onExpire();
  }, [remaining, onExpire]);

  return (
    <p className="text-sm text-amber-600 mb-3">
      Too many attempts — retry in <span className="tabular-nums font-medium">{remaining}s</span>
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
