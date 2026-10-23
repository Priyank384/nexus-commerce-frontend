import { expect, test } from "@playwright/test";
import { addFirstProductToBag, registerNewUser } from "./account";
import { visit } from "./visit";

test("checkout walks contact → delivery → payment review", async ({ page }) => {
  await registerNewUser(page);
  await addFirstProductToBag(page);

  await page
    .getByRole("dialog", { name: "Your bag" })
    .getByRole("link", { name: "Checkout" })
    .click();
  await expect(page).toHaveURL(/\/checkout$/);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Almost yours" })).toBeVisible();
  await expect(main.getByText("Order summary")).toBeVisible();

  // Contact — the email is fixed to the account, name and phone are the shopper's.
  await main.getByLabel("Full name").fill("Asha Rao");
  await main.getByLabel("Phone").fill("9800000000");
  await main.getByRole("button", { name: "Continue to delivery" }).click();

  // First order: the address form opens directly, prefilled with the contact name.
  await expect(main.getByRole("heading", { name: "Delivery address" })).toBeVisible();
  await expect(main.getByLabel("Recipient name")).toHaveValue("Asha Rao");
  await main.getByLabel("Address line 1").fill("14 Lavelle Road");
  await main.getByLabel("Address line 2 (optional)").fill("Indiranagar");
  await main.getByLabel("City").fill("Bengaluru");
  await main.getByLabel("State").fill("Karnataka");
  await main.getByLabel("PIN code").fill("560038");
  await main.getByRole("button", { name: "Save and continue" }).click();

  // Payment review: the address that was just saved is what the order will snapshot.
  await expect(main.getByRole("button", { name: /^Pay ₹/ })).toBeVisible();
  await expect(main.getByText("14 Lavelle Road, Indiranagar")).toBeVisible();
  await expect(main.getByText("Bengaluru, Karnataka, 560038")).toBeVisible();
  await expect(main.getByText("Razorpay · UPI, cards and netbanking")).toBeVisible();
  await expect(main.getByText("Free delivery on every order · 3–5 working days")).toBeVisible();
});

test("checkout with an empty bag sends the shopper back to the catalogue", async ({ page }) => {
  await registerNewUser(page);

  await visit(page, "/checkout");
  await expect(page).toHaveURL(/\/checkout$/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Nothing to check out" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Browse the collection" })).toHaveAttribute(
    "href",
    "/products",
  );
});
