import { expect, type Page } from "@playwright/test";
import { visit } from "./visit";

export type TestAccount = {
  email: string;
  password: string;
  name: string;
  /** Bearer token captured from the auto-login that follows registration. */
  token: string;
};

/**
 * Register through the UI (which also proves the signup path) and keep the token the BFF
 * login returns, so a spec can seed addresses/orders over the API for the same account
 * without spending another login against the rate limiter.
 */
export async function registerNewUser(page: Page): Promise<TestAccount> {
  const stamp = Date.now();
  const email = `pw-p4-${stamp}@nexus.test`;
  const password = "correct-horse-battery";
  const name = `PW Phase4 ${stamp}`;

  await visit(page, "/register");
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") && response.request().method() === "POST",
    { timeout: 30_000 },
  );

  const form = page.getByRole("main");
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Phone").fill("555-0199");
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: /^Sign up$/ }).click();

  const tokenBody = (await (await loginResponse).json()) as { data?: { token?: string } };
  await expect(page).toHaveURL(/\/$/);

  const token = tokenBody.data?.token;
  if (!token) throw new Error("Registration auto-login did not return an access token");
  return { email, password, name, token };
}

/** Browse the listing, open the first product and add it with the default variant. */
export async function addFirstProductToBag(page: Page) {
  await visit(page, "/products");
  // A reload drops the in-memory access token; the header rehydrates it from the
  // refresh cookie. Waiting for the signed-in nav keeps the click from racing that.
  await expect(page.locator("header").getByRole("link", { name: "Orders" })).toBeVisible();
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
}

export type SeededOrder = {
  id: number;
  totalPrice: number;
  variantSize: string;
  variantColorName: string;
};

/**
 * Places an unpaid order for the account over the BFF, exactly the way checkout does, so
 * order-history specs do not need the Razorpay window. Returns the identity the UI must
 * show back from the snapshots.
 */
export async function seedUnpaidOrder(page: Page, token: string): Promise<SeededOrder> {
  const auth = { Authorization: `Bearer ${token}` };

  const addressResponse = await page.request.post("/api/v1/addresses", {
    headers: auth,
    data: {
      label: "Home",
      recipientName: "Asha Rao",
      phone: "9800000000",
      line1: "14 Lavelle Road",
      line2: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560038",
      country: "IN",
      defaultShipping: true,
      defaultBilling: true,
    },
  });
  expect(addressResponse.ok()).toBeTruthy();
  const address = (await addressResponse.json()) as { data: { id: number } };

  const variantsResponse = await page.request.get("/api/v1/products/1101/variants");
  expect(variantsResponse.ok()).toBeTruthy();
  const variants = (await variantsResponse.json()) as {
    data: { id: number; size: string; colorName: string; stock: number }[];
  };
  const variant = variants.data.find((entry) => entry.stock > 0);
  if (!variant) throw new Error("Product 1101 has no purchasable variant");

  const cartResponse = await page.request.post("/api/v1/cart/items", {
    headers: auth,
    data: { productId: 1101, variantId: variant.id, quantity: 1 },
  });
  expect(cartResponse.ok()).toBeTruthy();

  const checkoutResponse = await page.request.post("/api/v1/cart/checkout", {
    headers: { ...auth, "Idempotency-Key": `e2e-${Date.now()}` },
    data: { orderItems: [], addressId: address.data.id },
  });
  expect(checkoutResponse.ok()).toBeTruthy();
  const order = (await checkoutResponse.json()) as {
    data: { id: number; totalPrice: number };
  };

  return {
    id: order.data.id,
    totalPrice: order.data.totalPrice,
    variantSize: variant.size,
    variantColorName: variant.colorName,
  };
}
