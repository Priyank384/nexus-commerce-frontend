"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/session";

// Same client-side guard pattern as (user), plus a role check.
// Real authorization is on the backend (ROLE_ADMIN) — this is UX.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hydrated } = useSession();
  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace("/login");
    else if (user.role !== "ADMIN") router.replace("/");
  }, [hydrated, user, router]);
  if (!hydrated) return <div className="text-muted-foreground">Loading…</div>;
  if (!user || user.role !== "ADMIN") return null;
  return <>{children}</>;
}
