import type { Metadata } from "next";
import { AdminGate } from "@/components/admin/admin-gate";

// The admin console only renders for a signed-in ADMIN, which the store cannot know
// during a static prefetch. Blocking navigation is honest here, same as (user).
export const instant = false;

export const metadata: Metadata = {
  // The admin pages themselves are client components and cannot export metadata, so the
  // segment title lives here rather than leaving tabs showing the storefront title.
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
