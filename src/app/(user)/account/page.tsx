import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "Account",
  description: "Your details, saved addresses and kept pieces.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountView />;
}
