import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Frame, type Page } from "@playwright/test";
import { addFirstProductToBag, registerNewUser, seedUnpaidOrder } from "./account";
import { visit } from "./visit";

// These specs talk to the real Razorpay test-mode gateway and settle a real test order, so
// they never run as part of the normal suite: `LIVE_PAYMENT=1 npx playwright test
// e2e/live-payment.spec.ts`. The signed-webhook spec also needs the backend's
// RAZORPAY_WEBHOOK_SECRET, read from ../NexusCommerce/.env when not already exported.
const enabled = process.env.LIVE_PAYMENT === "1";
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:3001";

test.describe("live Razorpay test mode", () => {
  test.skip(!enabled, "Set LIVE_PAYMENT=1 to exercise the real Razorpay gateway");

  test("a test card captures payment and the order keeps its snapshots", async ({ page }, testInfo) => {
    test.setTimeout(240_000);

    await registerNewUser(page);
    await addFirstProductToBag(page);

    await page
      .getByRole("dialog", { name: "Your bag" })
      .getByRole("link", { name: "Checkout" })
      .click();
    await expect(page).toHaveURL(/\/checkout$/);

    const main = page.getByRole("main");
    await main.getByLabel("Full name").fill("Asha Rao");
    await main.getByLabel("Phone").fill("9800000000");
    await main.getByRole("button", { name: "Continue to delivery" }).click();

    await main.getByLabel("Address line 1").fill("14 Lavelle Road");
    await main.getByLabel("Address line 2 (optional)").fill("Indiranagar");
    await main.getByLabel("City").fill("Bengaluru");
    await main.getByLabel("State").fill("Karnataka");
    await main.getByLabel("PIN code").fill("560038");
    await main.getByRole("button", { name: "Save and continue" }).click();

    const pay = main.getByRole("button", { name: /^Pay ₹/ });
    await expect(pay).toBeEnabled();
    await pay.click();

    await payByTestCard(page);

    await expect(page).toHaveURL(/\/orders\/\d+\?paid=1$/, { timeout: 90_000 });
    await expect(main.getByText("Thank you — we will email you when your order ships.")).toBeVisible();
    await expect(main.getByText("Payment captured").first()).toBeVisible();

    // Layout, address and variant were all frozen at checkout, not read back from the
    // catalogue or the address book. Scope to the order regions: the router keeps the
    // checkout segment cached in the DOM, and it shows the same address.
    const shipping = page.getByRole("region", { name: "Shipping address" });
    await expect(shipping.getByText("Asha Rao")).toBeVisible();
    await expect(shipping.getByText("14 Lavelle Road, Indiranagar")).toBeVisible();
    await expect(shipping.getByText("Bengaluru, Karnataka, 560038")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Items" }).getByText(/\w[\w '-]* · (XS|S|M|L|XL|XXL)\b/),
    ).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath("order-paid.png"), timeout: 15_000 });

    await visit(page, "/orders");
    const row = page.getByRole("main").getByRole("link").filter({ hasText: /Order #\d+/ }).first();
    await expect(row).toContainText("Payment captured");
    await page.screenshot({ path: testInfo.outputPath("orders-list.png"), timeout: 15_000 });
  });

  test("a signed payment.captured webhook settles an unpaid order exactly once", async ({ page }) => {
    const account = await registerNewUser(page);
    const order = await seedUnpaidOrder(page, account.token);
    const auth = { Authorization: `Bearer ${account.token}` };

    const intentResponse = await page.request.post(
      `${BACKEND}/api/v1/payments/razorpay/orders/${order.id}`,
      { headers: auth, data: {} },
    );
    expect(intentResponse.ok()).toBeTruthy();
    const intent = (await intentResponse.json()) as { data: { razorpayOrderId: string } };
    expect(intent.data.razorpayOrderId).toMatch(/^order_/);

    const paymentId = `pay_TEST${Date.now()}`;
    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        order: { entity: { id: intent.data.razorpayOrderId, amount_paid: Math.round(order.totalPrice * 100) } },
        payment: { entity: { id: paymentId, order_id: intent.data.razorpayOrderId, status: "captured" } },
      },
    });

    await deliverWebhook(page, body);

    const status = await page.request.get(
      `${BACKEND}/api/v1/payments/orders/${order.id}/status`,
      { headers: auth },
    );
    expect(status.ok()).toBeTruthy();
    const statusBody = (await status.json()) as {
      data: { paymentStatus: string; razorpayPaymentId: string; paidAt: string | null };
    };
    expect(statusBody.data.paymentStatus).toBe("PAID");
    expect(statusBody.data.razorpayPaymentId).toBe(paymentId);
    expect(statusBody.data.paidAt).not.toBeNull();

    // Razorpay retries a webhook it did not get a 2xx for; a redelivery must stay a no-op
    // rather than overwrite the capture or send a second confirmation.
    await deliverWebhook(page, body);
    const replay = await page.request.get(
      `${BACKEND}/api/v1/payments/orders/${order.id}/status`,
      { headers: auth },
    );
    const replayBody = (await replay.json()) as { data: { paymentStatus: string; razorpayPaymentId: string } };
    expect(replayBody.data.paymentStatus).toBe("PAID");
    expect(replayBody.data.razorpayPaymentId).toBe(paymentId);

    await visit(page, `/orders/${order.id}`);
    const main = page.getByRole("main");
    await expect(main.getByText("Payment captured").first()).toBeVisible();
    await expect(main.getByText("Asha Rao")).toBeVisible();
    await expect(main.getByText(`${order.variantColorName} · ${order.variantSize}`)).toBeVisible();
  });

  // The Phase 4 gate: capture a real test payment while the store is down, bring it back,
  // and let Razorpay's webhook — not the browser — settle the order. Opt-in twice over
  // because it stops and restarts the Spring process named by BACKEND_PID.
  test("a payment captured while the server is down settles when the webhook arrives", async ({
    page,
  }, testInfo) => {
    test.skip(process.env.LIVE_KILL !== "1", "Set LIVE_KILL=1 and BACKEND_PID to run the outage gate");
    test.setTimeout(600_000);
    const backendPid = Number(process.env.BACKEND_PID);
    if (!Number.isInteger(backendPid) || backendPid <= 0) {
      throw new Error("BACKEND_PID must name the running Spring process");
    }

    const account = await registerNewUser(page);
    await addFirstProductToBag(page);
    await page
      .getByRole("dialog", { name: "Your bag" })
      .getByRole("link", { name: "Checkout" })
      .click();
    const main = page.getByRole("main");
    await main.getByLabel("Full name").fill("Asha Rao");
    await main.getByLabel("Phone").fill("9800000000");
    await main.getByRole("button", { name: "Continue to delivery" }).click();
    await main.getByLabel("Address line 1").fill("14 Lavelle Road");
    await main.getByLabel("Address line 2 (optional)").fill("Indiranagar");
    await main.getByLabel("City").fill("Bengaluru");
    await main.getByLabel("State").fill("Karnataka");
    await main.getByLabel("PIN code").fill("560038");
    await main.getByRole("button", { name: "Save and continue" }).click();

    let intentId: string | null = null;
    let orderId: number | null = null;
    let verifiedPaymentId: string | null = null;
    page.on("response", async (response) => {
      const path = new URL(response.url()).pathname;
      if (/\/api\/v1\/payments\/razorpay\/orders\/\d+$/.test(path)) {
        const body = (await response.json().catch(() => null)) as
          | { data?: { razorpayOrderId?: string } }
          | null;
        intentId = body?.data?.razorpayOrderId ?? intentId;
      }
      if (path.endsWith("/api/v1/cart/checkout")) {
        const body = (await response.json().catch(() => null)) as
          | { data?: { id?: number } }
          | null;
        orderId = body?.data?.id ?? orderId;
      }
    });
    await page.route("**/api/v1/payments/razorpay/orders/*/verify", async (route) => {
      const body = route.request().postDataJSON() as { razorpayPaymentId?: string };
      verifiedPaymentId = body?.razorpayPaymentId ?? verifiedPaymentId;
      await route.continue();
    });

    const pay = main.getByRole("button", { name: /^Pay ₹/ });
    await pay.click();
    const frame = await waitForCardForm(page);

    // Stop the store before the card is entered, so the success handler's verify call can
    // never reach it. The Razorpay host is independent and keeps working.
    process.kill(backendPid, "SIGTERM");
    await waitForBackend(false, 60_000);

    await fillTestCard(frame);
    await advanceCheckout(page, () => verifiedPaymentId !== null, 120_000);
    expect(verifiedPaymentId).not.toBeNull();
    expect(orderId).not.toBeNull();
    expect(intentId).not.toBeNull();

    // Bring the store back before delivering the event, exactly like a restart after a deploy.
    const backendDir = join(process.cwd(), "..", "NexusCommerce");
    const bootRun = spawn("./gradlew", ["bootRun"], {
      cwd: backendDir,
      detached: true,
      stdio: "ignore",
    });
    bootRun.unref();
    await waitForBackend(true, 240_000);

    const body = JSON.stringify({
      event: "payment.captured",
      payload: {
        order: { entity: { id: intentId } },
        payment: { entity: { id: verifiedPaymentId, order_id: intentId, status: "captured" } },
      },
    });
    await deliverWebhook(page, body);

    const status = await page.request.get(`${BACKEND}/api/v1/payments/orders/${orderId}/status`, {
      headers: { Authorization: `Bearer ${account.token}` },
    });
    expect(status.ok()).toBeTruthy();
    const statusBody = (await status.json()) as {
      data: { paymentStatus: string; razorpayPaymentId: string; paidAt: string | null };
    };
    expect(statusBody.data.paymentStatus).toBe("PAID");
    expect(statusBody.data.razorpayPaymentId).toBe(verifiedPaymentId);
    expect(statusBody.data.paidAt).not.toBeNull();

    await visit(page, `/orders/${orderId}`);
    await expect(page.getByRole("main").getByText("Payment captured").first()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("webhook-settled-after-restart.png"), timeout: 15_000 });
  });
});

/** Finds the Razorpay checkout frame whichever nested document the card form lives in. */
async function waitForCardForm(page: Page): Promise<Frame> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      if (!/razorpay/i.test(frame.url())) continue;
      const card = frame.locator('input[name="card.number"], input[autocomplete="cc-number"]');
      try {
        if ((await card.count()) > 0) return frame;
      } catch {
        // The iframe document was replaced mid-query; the next poll sees the new one.
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error("Razorpay checkout never showed the card form");
}

async function firstPresent(frame: Frame, selectors: string[]) {
  for (const selector of selectors) {
    try {
      const locator = frame.locator(selector).first();
      if ((await locator.count()) > 0) return locator;
    } catch {
      // Razorpay swaps its iframe document between steps; treating a detached frame as
      // "not here yet" lets the next poll find the new document.
    }
  }
  return null;
}

/**
 * Razorpay's Indian test Visa: 4100 2800 0000 1007, any future expiry and CVV. After the
 * card form, test mode asks whether to save the card for RBI compliance; declining keeps
 * the guest-payment path, which test mode captures without a bank page.
 */
async function payByTestCard(page: Page) {
  const frame = await waitForCardForm(page);
  await fillTestCard(frame);
  await waitForCheckoutOutcome(page);
}

async function fillTestCard(frame: Frame) {
  const card = await firstPresent(frame, ['input[name="card.number"]', 'input[autocomplete="cc-number"]']);
  if (!card) throw new Error("Card number field not found");
  await card.fill("4100280000001007");

  const expiry = await firstPresent(frame, ['input[name="card.expiry"]', 'input[autocomplete="cc-exp"]']);
  if (!expiry) throw new Error("Expiry field not found");
  await expiry.fill("1230");

  const cvv = await firstPresent(frame, ['input[name="card.cvv"]', 'input[autocomplete="cc-csc"]']);
  if (!cvv) throw new Error("CVV field not found");
  await cvv.fill("123");

  const name = await firstPresent(frame, ['input[name="card.name"]', 'input[autocomplete="cc-name"]']);
  if (name) await name.fill("Asha Rao");

  // The RBI "save this card" opt-in stays unticked: ticking it adds a six-digit
  // tokenisation OTP step that is only about storing the card, not about paying.
  // The card sub-form is saved with "Continue"; the outcome loop walks the rest.
  await frame.getByRole("button", { name: /^continue$/i }).last().click({ force: true }).catch(() => {});
}

async function waitForCheckoutOutcome(page: Page) {
  await advanceCheckout(page, () => /\/orders\/\d+/.test(new URL(page.url()).pathname), 120_000);
}

/**
 * Walks the Razorpay sheet forward: the final Pay button and, when the instrument asks for
 * one, the test OTP. `done` ends the walk early — the normal flow ends on the order page,
 * the outage flow ends when the browser has a payment id to verify.
 */
async function advanceCheckout(page: Page, done: () => boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let otpHandled = false;
  let payClicked = false;
  let successClicked = false;
  let consentHandled = false;
  let saveCardHandled = false;
  let continueClicks = 0;
  // The mock bank page can open as a popup, so every open page is fair game.
  const frames = () => page.context().pages().flatMap((candidate) => candidate.frames());
  while (Date.now() < deadline) {
    if (done()) return;

    // After the card form, Razorpay asks whether to tokenise the card for RBI compliance.
    // Declining is the ordinary guest-payment path and skips the tokenisation OTP.
    if (!consentHandled) {
      for (const candidate of frames()) {
        const maybeLater = candidate.getByRole("button", { name: /^maybe later$/i }).last();
        if (await maybeLater.isVisible().catch(() => false)) {
          await maybeLater.click({ force: true }).catch(() => {});
          consentHandled = true;
          await page.waitForTimeout(1_000);
          break;
        }
      }
    }

    // If the sheet insists on tokenising, it texts a six-digit OTP the test number never
    // receives. Skipping keeps the payment moving; otherwise any six digits work in test mode.
    if (!saveCardHandled) {
      for (const candidate of frames()) {
        const skip = candidate.getByText(/^skip otp$/i).last();
        if (await skip.isVisible().catch(() => false)) {
          await skip.click({ force: true }).catch(() => {});
          saveCardHandled = true;
          await page.waitForTimeout(1_000);
          break;
        }
        const boxes = candidate.locator('input[maxlength="1"]:visible');
        const boxCount = await boxes.count().catch(() => 0);
        if (boxCount >= 4) {
          for (let index = 0; index < Math.min(boxCount, 6); index += 1) {
            await boxes.nth(index).fill("123456"[index]).catch(() => {});
          }
          saveCardHandled = true;
        }
      }
    }

    // Razorpay sometimes swallows the first Continue while its card lookup re-renders the
    // form; retrying until the sub-form disappears is what makes the run deterministic.
    if (continueClicks < 12) {
      for (const candidate of frames()) {
        const cont = candidate.getByRole("button", { name: /^continue$/i }).last();
        if (await cont.isVisible().catch(() => false)) {
          await cont.click({ timeout: 2_000, force: true }).catch(() => {});
          continueClicks += 1;
          await page.waitForTimeout(1_000);
          break;
        }
      }
    }

    if (!otpHandled) {
      for (const candidate of frames()) {
        const otp = await firstPresent(candidate, [
          'input[name="otp"]',
          'input[autocomplete="one-time-code"]',
          'input[placeholder*="OTP" i]',
        ]);
        if (otp && (await otp.isVisible().catch(() => false))) {
          await otp.fill("1234");
          otpHandled = true;
          break;
        }
      }
    }

    if (!payClicked) {
      for (const candidate of frames()) {
        const payButton = candidate.getByRole("button", { name: /^pay( now| ₹.*)?$/i }).last();
        if (await payButton.isVisible().catch(() => false)) {
          await payButton.click().catch(() => {});
          payClicked = true;
          break;
        }
      }
    }

    // The mock bank page confirms with a Success button, with or without an OTP field.
    if (!successClicked) {
      for (const candidate of frames()) {
        const success = candidate.getByRole("button", { name: /^(success|submit|verify)$/i }).last();
        if (await success.isVisible().catch(() => false)) {
          await success.click().catch(() => {});
          successClicked = true;
          break;
        }
      }
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Razorpay checkout did not finish");
}

async function waitForBackend(up: boolean, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let healthy = false;
    try {
      const response = await fetch(`${BACKEND}/actuator/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      healthy = response.ok;
    } catch {
      healthy = false;
    }
    if (healthy === up) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Backend did not ${up ? "start" : "stop"} within ${timeoutMs}ms`);
}

async function deliverWebhook(page: Page, body: string) {
  const signature = createHmac("sha256", webhookSecret()).update(body).digest("hex");
  const response = await page.request.post(`${BACKEND}/api/v1/payments/razorpay/webhook`, {
    headers: { "Content-Type": "application/json", "X-Razorpay-Signature": signature },
    data: body,
  });
  expect(response.ok()).toBeTruthy();
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
