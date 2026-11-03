import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  // The URL carries a live, single-use credential. A crawler, a link unfurler or a browser
  // preload could otherwise spend it before the shopper does.
  robots: { index: false, follow: false },
};

/** The path the emailed reset link points at, so it has to match the mailer in SmtpNotificationService. */
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
