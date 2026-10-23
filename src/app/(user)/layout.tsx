import { UserGate } from "@/components/auth/user-gate";

// Every route under this layout is gated on the in-memory session, so it cannot render
// an instant navigation shell — the dev validator would flag each of cart/checkout/orders
// on every visit. Blocking navigation is the honest behaviour for signed-in routes.
export const instant = false;

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <UserGate>{children}</UserGate>;
}
