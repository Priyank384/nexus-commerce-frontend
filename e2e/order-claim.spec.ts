import { expect, test } from "@playwright/test";
import { visit } from "./visit";
import { registerNewUser } from "./account";

// The shape the backend accepts for a claim token (43 base64url characters, the same one
// OpaqueToken mints) but that no order was ever issued. A malformed value would be rejected by
// validation and never reach the lookup this spec is about.
const BOGUS = "q".repeat(43);

test.describe("order claim", () => {
  test("a signed-out shopper is sent to sign in with the link still attached", async ({ page }) => {
    await visit(page, `/orders/claim?token=${BOGUS}`);

    // The emailed link is the only thing that can claim an order, so losing it to the sign-in
    // bounce would strand the shopper on a page with nothing left to claim.
    await expect(page).toHaveURL(
      new RegExp(`/login\\?next=%2Forders%2Fclaim%3Ftoken%3D${BOGUS}`),
    );
  });

  test("explains the email link when the address carries no token", async ({ page }) => {
    await registerNewUser(page);
    await visit(page, "/orders/claim");
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: "Claim an order" })).toBeVisible();
    await expect(main.getByRole("button", { name: /claim this order/i })).not.toBeVisible();

    const spent: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/orders/claim")) spent.push(request.url());
    });
    await page.waitForTimeout(500);
    expect(spent).toHaveLength(0);
  });

  test("claims nothing without a press, then answers a dead link with the store's own reason", async ({
    page,
  }) => {
    await registerNewUser(page);

    const calls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/orders/claim")) calls.push(request.url());
    });

    await visit(page, `/orders/claim?token=${BOGUS}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "Claim this order" })).toBeVisible();

    // Opening the link is not consent to move an order onto an account: the claim is one-way and
    // retires the token, so a curious tap on an email must leave it usable.
    await page.waitForTimeout(500);
    expect(calls).toHaveLength(0);

    await main.getByRole("button", { name: /claim this order/i }).click();
    await expect(main.getByRole("heading", { name: /will not claim an order/i })).toBeVisible();
    expect(calls).toHaveLength(1);
    await expect(main.getByText(/not valid, has already been used/i)).toBeVisible();
    // The token stays in the address: a 404 here is the store's answer about the link, not
    // something the browser has spent.
    await expect(page).toHaveURL(new RegExp(`token=${BOGUS}`));
  });
});
