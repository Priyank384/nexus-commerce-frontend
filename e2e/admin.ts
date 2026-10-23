import { expect, type Page } from "@playwright/test";
import { visit } from "./visit";

/**
 * The ADMIN account is bootstrapped from ../NexusCommerce/.env, so the specs read the same
 * variables the backend started with: `source ../NexusCommerce/.env` before `npm run test:e2e`.
 */
export function adminCredentials() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set");
  }
  return { email, password };
}

export async function loginAsAdmin(page: Page) {
  const { email, password } = adminCredentials();
  await visit(page, "/login");
  const main = page.getByRole("main");
  await main.getByLabel("Email").fill(email);
  await main.getByLabel("Password").fill(password);
  await main.getByRole("button", { name: /^Log in$/ }).click();
  await expect(page.locator("header").getByText(email)).toBeVisible({ timeout: 30_000 });
  return email;
}
