import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Account",
  description: "Your details, saved addresses and kept pieces.",
  robots: { index: false, follow: false },
};

// The (user) layout gates on the in-memory session, so this segment never renders during
// an instant navigation. Declaring it keeps the dev validator from warning on every visit.
export const instant = false;

export default function AccountPage() {
  return <AccountView />;
}
