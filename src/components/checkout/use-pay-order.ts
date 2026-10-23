"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { toAuthFailure } from "@/lib/api/errors";
import { openRazorpay } from "./razorpay";

export type PayResult =
  | { status: "paid"; orderId: number }
  | { status: "dismissed"; orderId: number }
  | { status: "failed"; orderId: number; message: string };

export type PaymentPrefill = { name?: string; email?: string; contact?: string };

/**
 * Creates (or reuses) the gateway intent, opens checkout, then verifies the signature on
 * the server before calling the order paid. Shared by first-time checkout and the
 * "complete payment" retry on an order that was saved but never paid.
 */
export function usePayOrder() {
  const queryClient = useQueryClient();
  const [payingFor, setPayingFor] = useState<number | null>(null);

  async function pay(orderId: number, prefill?: PaymentPrefill): Promise<PayResult> {
    setPayingFor(orderId);
    try {
      const intent = await api.POST("/api/v1/payments/razorpay/orders/{orderId}", {
        params: { path: { orderId } },
      });
      if (!intent.response.ok || !intent.data?.data) {
        return {
          status: "failed",
          orderId,
          message: toAuthFailure(intent.response.status, intent.error ?? null).message,
        };
      }
      const ticket = intent.data.data;
      if (!ticket.keyId || !ticket.razorpayOrderId || ticket.amount == null) {
        return {
          status: "failed",
          orderId,
          message: "The payment gateway is not configured. Your order is saved — contact us to pay.",
        };
      }

      const outcome = await openRazorpay({
        keyId: ticket.keyId,
        amount: ticket.amount,
        currency: ticket.currency ?? "INR",
        razorpayOrderId: ticket.razorpayOrderId,
        orderId,
        prefill,
      });
      if (outcome.status === "dismissed") {
        return { status: "dismissed", orderId };
      }
      if (outcome.status === "failed") {
        return { status: "failed", orderId, message: outcome.message };
      }

      const verify = await api.POST("/api/v1/payments/razorpay/orders/{orderId}/verify", {
        params: { path: { orderId } },
        body: {
          razorpayPaymentId: outcome.paymentId,
          razorpaySignature: outcome.signature,
        },
      });
      if (!verify.response.ok || !verify.data?.data) {
        return {
          status: "failed",
          orderId,
          message: toAuthFailure(verify.response.status, verify.error ?? null).message,
        };
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["order", orderId] }),
      ]);
      return { status: "paid", orderId };
    } catch {
      return {
        status: "failed",
        orderId,
        message: "Could not reach the store. Your order is saved — try paying from your orders.",
      };
    } finally {
      setPayingFor(null);
    }
  }

  return { pay, payingFor };
}
