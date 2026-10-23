import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3001";

/**
 * The only way to make an order PAID without the Razorpay sheet. The backend verifies the
 * signature over the raw bytes, so the body must be sent exactly as signed.
 */
export async function deliverWebhook(page: Page, body: string) {
  const signature = createHmac("sha256", webhookSecret()).update(body).digest("hex");
  const response = await page.request.post(`${BACKEND}/api/v1/payments/razorpay/webhook`, {
    headers: { "Content-Type": "application/json", "X-Razorpay-Signature": signature },
    data: body,
  });
  expect(response.ok()).toBeTruthy();
}

/**
 * Creates a Razorpay test-mode intent for an unpaid order and settles it with a signed
 * payment.captured event. This still calls the real Razorpay API, so callers stay opt-in.
 */
export async function settleOrder(
  page: Page,
  token: string,
  order: { id: number; totalPrice: number },
): Promise<string> {
  const intentResponse = await page.request.post(
    `${BACKEND}/api/v1/payments/razorpay/orders/${order.id}`,
    { headers: { Authorization: `Bearer ${token}` }, data: {} },
  );
  expect(intentResponse.ok()).toBeTruthy();
  const intent = (await intentResponse.json()) as { data: { razorpayOrderId: string } };

  const paymentId = `pay_E2E${Date.now()}`;
  const body = JSON.stringify({
    event: "payment.captured",
    payload: {
      order: {
        entity: {
          id: intent.data.razorpayOrderId,
          amount_paid: Math.round(order.totalPrice * 100),
        },
      },
      payment: {
        entity: {
          id: paymentId,
          order_id: intent.data.razorpayOrderId,
          status: "captured",
        },
      },
    },
  });
  await deliverWebhook(page, body);
  return paymentId;
}

/** Read from the environment first; fall back to the backend's git-ignored .env. */
function webhookSecret(): string {
  const fromEnv = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (fromEnv) return fromEnv;
  const envFile = readFileSync(join(process.cwd(), "..", "NexusCommerce", ".env"), "utf8");
  const line = envFile.split("\n").find((entry) => entry.startsWith("RAZORPAY_WEBHOOK_SECRET="));
  const value = line?.slice("RAZORPAY_WEBHOOK_SECRET=".length).trim();
  if (!value) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
  return value;
}
