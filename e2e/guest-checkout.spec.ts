import { expect, test } from "@playwright/test";
import { visit } from "./visit";

/**
 * The whole point of the guest spine: nobody signs in, yet the bag is real, survives a reload,
 * and reaches a payment review. Everything here runs against the live backend with only the
 * minted session credential behind it.
 */
test("an anonymous visitor fills a bag, keeps it through a reload and reaches the payment review", async ({
  page,
}) => {
  await visit(page, "/products");
  await page
    .getByRole("main")
    .locator('a[href^="/products/"]')
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 30_000 });

  const add = page.getByRole("button", { name: /^Add to bag/ });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByRole("dialog", { name: "Your bag" })).toBeVisible();

  // Without this the bag would be nobody's and a reload would empty it.
  const token = await page.evaluate(() => window.localStorage.getItem("nx.guest-token"));
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

  await visit(page, "/cart");
  await expect(page.getByRole("main").getByRole("listitem")).not.toHaveCount(0);

  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Contact" })).toBeVisible();
  await expect(main.getByText(/no account needed/i)).toBeVisible();
  await expect(main.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/login?next=%2Fcheckout",
  );

  await main.getByLabel("Email").fill(`pw-guest-${Date.now()}@nexus.test`);
  await main.getByLabel("Full name").fill("Asha Rao");
  await main.getByLabel("Phone").fill("9800000000");
  await main.getByRole("button", { name: "Continue to delivery" }).click();

  // A guest types the destination instead of picking one, because there is no address book.
  await expect(main.getByRole("heading", { name: "Delivery address" })).toBeVisible();
  await expect(main.getByRole("radio")).toHaveCount(0);
  await expect(main.getByLabel("Recipient name")).toHaveValue("Asha Rao");
  await main.getByLabel("Address line 1").fill("14 Lavelle Road");
  await main.getByLabel("City").fill("Bengaluru");
  await main.getByLabel("State").fill("Karnataka");
  await main.getByLabel("PIN code").fill("560038");
  await main.getByRole("button", { name: "Continue to payment" }).click();

  await expect(main.getByRole("heading", { name: "Payment" })).toBeVisible();
  await expect(main.getByRole("button", { name: /^Pay ₹/ })).toBeVisible();
  await expect(main.getByText("14 Lavelle Road")).toBeVisible();
  await expect(main.getByText("Bengaluru, Karnataka, 560038")).toBeVisible();
});

test("the bag and the till are open to a visitor with no session at all", async ({ page }) => {
  for (const path of ["/cart", "/checkout"]) {
    await visit(page, path);
    await expect(page).toHaveURL(new RegExp(`\\${path}$`));
  }
});

/**
 * The receipt page also answers a link the browser cannot prove — one opened on another device,
 * or an order since claimed onto an account. It has to say so and stop asking, because a page
 * that treats a rejection as a delay keeps a shopper staring at a spinner for two minutes.
 */
test("a receipt this browser cannot prove says so instead of waiting forever", async ({ page }) => {
  const checks: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/status")) checks.push(request.url());
  });

  await visit(page, "/checkout/done/999999");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: /cannot find that order/i })).toBeVisible();
  await expect(main.getByRole("link", { name: /claim with a link/i })).toBeVisible();

  await page.waitForTimeout(7_000);
  // The first read, plus the one retry the query layer allows — and nothing after that. A poll
  // still running would have added another every three seconds.
  expect(checks.length).toBeLessThanOrEqual(2);
});
