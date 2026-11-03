import type { Metadata } from "next";

// Deliberately no UserGate: a bag belongs to whoever is holding it, signed in or not, and
// checkout is the place where an anonymous shopper finally pays. Sign-in is an offer here,
// never a toll.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
