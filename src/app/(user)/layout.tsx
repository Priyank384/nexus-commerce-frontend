import type { Metadata } from "next";
import { UserGate } from "@/components/auth/user-gate";

// Every route under this layout is gated on the in-memory session, so it cannot render
// an instant navigation shell — the dev validator would flag each of account and orders
// on every visit. Blocking navigation is the honest behaviour for signed-in routes.
// The bag and checkout live in (shop), which is deliberately not gated: a guest owns them.
export const instant = false;

// Personal surfaces have nothing to offer a crawler and would only leak the login redirect.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <UserGate>{children}</UserGate>;
}
