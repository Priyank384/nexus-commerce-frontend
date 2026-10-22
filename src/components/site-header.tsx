"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, hydrated, set, clear } = useSession();

  // On first mount, ask the BFF to rehydrate the access token from the httpOnly
  // refresh cookie. If /api/auth/refresh 401s the store stays empty.
  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        if (!res.ok || cancelled) {
          if (!cancelled) useSession.getState().clear();
          return;
        }
        const body = (await res.json()) as { data?: { token?: string } };
        if (!cancelled) set(body?.data?.token ?? null);
      } catch {
        if (!cancelled) clear();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, set, clear]);

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clear();
  }

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex items-center justify-between px-4 py-3 max-w-6xl">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            NexusCommerce
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/products" className="hover:underline">
              Products
            </Link>
            {user && (
              <Link href="/cart" className="hover:underline">
                Cart
              </Link>
            )}
            {user && (
              <Link href="/orders" className="hover:underline">
                Orders
              </Link>
            )}
            {user?.role === "ADMIN" && (
              <Link href="/admin" className="hover:underline text-amber-600">
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {!hydrated && <span className="text-muted-foreground">…</span>}
          {hydrated && !user && (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
          {user && (
            <>
              <span className="text-muted-foreground">{user.email}</span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                Log out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
