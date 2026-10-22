"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { registerSchema, type RegisterValues } from "@/lib/validation/auth";
import { useSession } from "@/lib/auth/session";
import type { ApiEnvelope } from "@/lib/api/errors";

// Backend CreateUserRequestDto accepts phone as an optional plain string.
// Zod keeps it required in the form so users always see it, but the empty
// string is stripped before hitting Spring.
export function RegisterForm() {
  const router = useRouter();
  const set = useSession((s) => s.set);
  const [serverAlert, setServerAlert] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterValues) {
    setServerAlert(null);
    setServerFieldErrors({});

    // Register (POST /api/v1/users) is public; then auto-login via the BFF so
    // the user lands in the app signed in — matches how e-commerce signups
    // usually behave. Phone is required by the Zod schema (empty allowed) so
    // users always see the field; blank strings still reach Spring untouched.
    const registerBody = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      password: values.password,
    };

    let res: Response;
    try {
      res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerBody),
      });
    } catch {
      setServerAlert("Backend unreachable. Is Spring running on :3001?");
      return;
    }
    const body = (await res.json().catch(() => null)) as ApiEnvelope | null;

    if (res.status === 400) {
      // Spring's GlobalExceptionHandler aggregates field violations under `error`.
      setServerAlert(body?.message ?? "Please fix the highlighted fields.");
      if (body?.error && typeof body.error === "string") {
        const map: Record<string, string> = {};
        for (const part of body.error.split(";")) {
          const m = part.trim().match(/^(\w+):\s*(.+)$/);
          if (m) map[m[1]] = m[2];
        }
        setServerFieldErrors(map);
      }
      return;
    }
    if (res.status === 409) {
      setServerAlert(body?.message ?? "An account with that email already exists.");
      return;
    }
    if (!res.ok) {
      setServerAlert(body?.message ?? `Registration failed (${res.status}).`);
      return;
    }

    // Now log in through the BFF so the refresh cookie is set and the session
    // store has an access token.
    const login = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: values.email, password: values.password }),
    }).catch(() => null);
    const loginBody = login ? ((await login.json().catch(() => null)) as ApiEnvelope<{ token?: string }> | null) : null;

    if (!login?.ok || !loginBody?.data?.token) {
      toast.success("Account created — please log in");
      router.replace("/login");
      return;
    }
    set(loginBody.data.token);
    toast.success("Welcome!");
    router.replace("/");
  }

  return (
    <div className="max-w-sm mx-auto w-full">
      <h1 className="text-2xl font-semibold mb-4">Create account</h1>
      {serverAlert && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{serverAlert}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" {...register("name")} />
          {(errors.name || serverFieldErrors.name) && (
            <p className="text-sm text-destructive mt-1">{errors.name?.message ?? serverFieldErrors.name}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {(errors.email || serverFieldErrors.email) && (
            <p className="text-sm text-destructive mt-1">{errors.email?.message ?? serverFieldErrors.email}</p>
          )}
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" autoComplete="tel" {...register("phone")} />
          {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {(errors.password || serverFieldErrors.password) && (
            <p className="text-sm text-destructive mt-1">
              {errors.password?.message ?? serverFieldErrors.password}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Sign up"}
        </Button>
      </form>

      <p className="text-sm mt-4 text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
