"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/session";
import { Button, buttonVariants } from "@/components/ui/button";

const SHOP_LINKS = [
  { href: "/products", label: "Shop all" },
  { href: "/products?category=Men", label: "Men" },
  { href: "/products?category=Women", label: "Women" },
];

export function SiteHeader() {
  const { user, hydrated, set, clear } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

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
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="shell-x flex h-16 items-center gap-8">
        <Link href="/" className="text-sm font-medium tracking-[0.3em] uppercase">
          Plain Thread
        </Link>

        <nav className="hidden md:flex items-center gap-6" aria-label="Primary">
          {SHOP_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="label-caps text-muted-foreground hover:text-foreground">
              {link.label}
            </Link>
          ))}
          {user && (
            <Link href="/cart" className="label-caps text-muted-foreground hover:text-foreground">
              Cart
            </Link>
          )}
          {user && (
            <Link href="/orders" className="label-caps text-muted-foreground hover:text-foreground">
              Orders
            </Link>
          )}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="label-caps text-foreground underline underline-offset-4">
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {hydrated && !user && (
            <nav className="hidden md:flex items-center gap-5" aria-label="Sign in">
              <Link href="/login" className="label-caps text-muted-foreground hover:text-foreground">
                Log in
              </Link>
              <Link href="/register" className="label-caps text-foreground hover:opacity-70">
                Sign up
              </Link>
            </nav>
          )}
          {user && (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-xs text-muted-foreground truncate max-w-[16rem]">{user.email}</span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                Log out
              </Button>
            </div>
          )}
          {/* The e2e specs and the signed-out flash both key off these two states. */}
          {!hydrated && <span className="text-xs text-muted-foreground">&nbsp;</span>}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border"
          >
            <span aria-hidden className="text-lg leading-none">
              {menuOpen ? "×" : "≡"}
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav aria-label="Mobile" className="md:hidden border-t bg-background shell-x flex flex-col gap-4 py-5">
          {SHOP_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="label-caps" onClick={() => setMenuOpen(false)}>
              {link.label}
            </Link>
          ))}
          {user && (
            <>
              <Link href="/cart" className="label-caps" onClick={() => setMenuOpen(false)}>
                Cart
              </Link>
              <Link href="/orders" className="label-caps" onClick={() => setMenuOpen(false)}>
                Orders
              </Link>
            </>
          )}
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="label-caps" onClick={() => setMenuOpen(false)}>
              Admin
            </Link>
          )}
          {user ? (
            <>
              <span className="text-xs text-muted-foreground break-all">{user.email}</span>
              <Button variant="outline" size="sm" className="w-fit" onClick={onLogout}>
                Log out
              </Button>
            </>
          ) : (
            hydrated && (
              <div className="flex gap-3">
                {/* buttonVariants() rather than <Link><Button/></Link> — a button
                    inside an anchor is not valid HTML and confuses screen readers. */}
                <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Log in
                </Link>
                <Link href="/register" className={buttonVariants({ size: "sm" })}>
                  Sign up
                </Link>
              </div>
            )
          )}
        </nav>
      )}
    </header>
  );
}
