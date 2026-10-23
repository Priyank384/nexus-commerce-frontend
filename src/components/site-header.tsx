"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ensureSession, useSession } from "@/lib/auth/session";
import { useHydrated } from "@/lib/use-hydrated";
import { api } from "@/lib/api/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteSearch } from "@/components/site-search";

type NavNode = { id?: number; name?: string; slug?: string; children?: NavNode[] };

/**
 * The tree is public and cached server-side, so the nav can fetch it on every
 * cold load without a bearer. Roots with no children are dropped: a mega-menu
 * column that opens onto nothing is worse than no column.
 */
function useCategoryNav() {
  const { data } = useQuery({
    queryKey: ["category-tree"],
    queryFn: async () => {
      const { data: envelope } = await api.GET("/api/v1/categories/tree");
      return (envelope?.data ?? []) as NavNode[];
    },
    staleTime: 10 * 60_000,
    retry: 0,
  });
  return (data ?? []).filter((root) => (root.children?.length ?? 0) > 0);
}

export function SiteHeader() {
  const { user, hydrated, clear } = useSession();
  // Flips on the post-hydration render. Published on the header so e2e navigation can
  // wait for React to own the page instead of clicking a server-rendered button that has
  // no handler yet.
  const interactive = useHydrated();
  const [menuOpen, setMenuOpen] = useState(false);
  const roots = useCategoryNav();

  // On first mount, ask the BFF to rehydrate the access token from the httpOnly
  // refresh cookie. ensureSession shares one in-flight refresh with the API client,
  // so this cannot race a request that fired before hydration.
  useEffect(() => {
    if (hydrated) return;
    void ensureSession();
  }, [hydrated]);

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clear();
    setMenuOpen(false);
  }

  return (
    <header data-hydrated={interactive} className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="shell-x flex h-16 items-center gap-8">
        <Link href="/" className="text-sm font-medium tracking-[0.3em] uppercase">
          Plain Thread
        </Link>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          <Link href="/products" className="label-caps text-muted-foreground hover:text-foreground">
            Shop all
          </Link>
          {roots.map((root) => (
            <div key={root.id} className="group relative flex h-16 items-center">
              <Link
                href={`/products?category=${root.slug}`}
                className="label-caps text-muted-foreground group-hover:text-foreground"
              >
                {root.name}
              </Link>
              {/* Hover-only, so it stays out of the tab order until focus enters it.
                  role=group + label names the panel for assistive tech and lets the
                  e2e spec target one root's children — "Denim" exists under both Men
                  and Women. */}
              <div
                role="group"
                aria-label={`${root.name} categories`}
                className="invisible absolute top-full left-0 z-50 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                <div className="w-[26rem] rounded-md border bg-background p-6">
                  <p className="label-caps text-muted-foreground">{root.name}</p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2.5">
                    {(root.children ?? []).map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/products?category=${child.slug}`}
                          className="text-sm underline-offset-4 hover:underline"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
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
          <SiteSearch className="hidden lg:flex" />
          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground" />
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
              <span className="max-w-[16rem] truncate text-xs text-muted-foreground">{user.email}</span>
              <Button variant="outline" size="sm" onClick={onLogout}>
                Log out
              </Button>
            </div>
          )}
          {/* Keeps the row from collapsing while the session rehydrates. */}
          {!hydrated && <span className="text-xs text-muted-foreground">&nbsp;</span>}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
          >
            <span aria-hidden className="text-lg leading-none">
              {menuOpen ? "×" : "≡"}
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav aria-label="Mobile" className="shell-x flex flex-col gap-5 border-t bg-background py-6 md:hidden">
          <SiteSearch compact />
          <Link href="/products" className="label-caps" onClick={() => setMenuOpen(false)}>
            Shop all
          </Link>
          {roots.map((root) => (
            <div key={root.id}>
              <Link
                href={`/products?category=${root.slug}`}
                className="label-caps"
                onClick={() => setMenuOpen(false)}
              >
                {root.name}
              </Link>
              <ul className="mt-2 space-y-1.5 border-l pl-4">
                {(root.children ?? []).map((child) => (
                  <li key={child.id}>
                    <Link
                      href={`/products?category=${child.slug}`}
                      className="text-sm text-muted-foreground"
                      onClick={() => setMenuOpen(false)}
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
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
              <span className="break-all text-xs text-muted-foreground">{user.email}</span>
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
