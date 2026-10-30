"use client";

import Script from "next/script";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailure = {
  error?: { description?: string; reason?: string; code?: string };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
  handler: (response: RazorpayResponse) => void;
};

type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (event: string, handler: (payload: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export type PaymentOutcome =
  | { status: "paid"; paymentId: string; signature: string }
  | { status: "dismissed" }
  | { status: "failed"; message: string };

/** Mounted on every page that can start a payment; next/script dedupes by id. */
export function RazorpayScript() {
  return (
    <Script
      id="razorpay-checkout"
      src="https://checkout.razorpay.com/v1/checkout.js"
      strategy="afterInteractive"
    />
  );
}

/**
 * The script is afterInteractive, so a shopper who clicks "Pay" on first paint can beat it.
 * Resolving on the global rather than the script's onLoad keeps this callable from anywhere.
 */
function waitForRazorpay(timeoutMs = 10_000): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.Razorpay) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 100);
  });
}

export async function openRazorpay(options: {
  keyId: string;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  orderId: number;
  prefill?: RazorpayOptions["prefill"];
}): Promise<PaymentOutcome> {
  const ready = await waitForRazorpay();
  const RazorpayCheckout = window.Razorpay;
  if (!ready || !RazorpayCheckout) {
    return {
      status: "failed",
      message: "The payment window could not load. Check your connection and try again.",
    };
  }

  return new Promise<PaymentOutcome>((resolve) => {
    let settled = false;
    // Razorpay keeps the sheet open after a declined attempt and lets the shopper try another
    // card. Only the dismissal ends the session: settling on payment.failed would make a
    // later success a no-op, leaving a captured payment unverified on our side.
    let declined: string | null = null;
    const finish = (outcome: PaymentOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const checkout = new RazorpayCheckout({
      key: options.keyId,
      amount: options.amount,
      currency: options.currency,
      name: "Nexus Commerce",
      description: `Order #${options.orderId}`,
      order_id: options.razorpayOrderId,
      prefill: options.prefill,
      notes: { orderId: String(options.orderId) },
      // The same ink as the rest of the shell, so the gateway doesn't look pasted in.
      theme: { color: "#0f0f0f" },
      handler: (response) =>
        finish({
          status: "paid",
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        }),
      modal: {
        ondismiss: () =>
          finish(
            declined
              ? { status: "failed", message: declined }
              : { status: "dismissed" },
          ),
        escape: true,
        backdropclose: false,
      },
    });

    checkout.on("payment.failed", (payload) => {
      declined =
        payload.error?.description ??
        "The payment was declined. Nothing has been charged — try another method.";
    });
    checkout.open();
  });
}
