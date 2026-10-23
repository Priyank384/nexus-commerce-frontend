"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session";

// Client-side auth guard for signed-in-only routes. The BFF still enforces
// bearer on the backend, so this is UX, not security — it just avoids a
// flash of "unauthorized" content while the API call 401s.
export function UserGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hydrated } = useSession();

  useEffect(() => {
    if (hydrated && !user) {
      const here = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(here)}`);
    }
  }, [hydrated, user, router]);

  if (!hydrated) return <div className="text-muted-foreground">Loading…</div>;
  if (!user) return null;
  return <>{children}</>;
}
