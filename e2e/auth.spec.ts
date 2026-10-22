import { expect, test } from "@playwright/test";

// Phase 1 live auth flow. Requires the Spring backend on :3001 and Redis on
// :6379. Each run generates a unique email so repeated runs don't collide.
test("register → auto-login → header shows email → logout", async ({ page }) => {
  const stamp = Date.now();
  const email = `pw-${stamp}@nexus.test`;
  const password = "correct-horse-battery";

  await page.goto("/register");
  // The signed-out header also renders "Sign up"/"Log in" buttons, so scope to the form.
  const form = page.getByRole("main");
  await form.getByLabel("Name").fill(`PW Tester ${stamp}`);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Phone").fill("555-0199");
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: /^Sign up$/ }).click();

  // On success the form calls router.replace("/") — the (public) home
  // immediately redirects to /products.
  await expect(page).toHaveURL(/\/products$/, { timeout: 8_000 });

  const header = page.locator("header");
  await expect(header.getByText(email)).toBeVisible();

  // Sign out from the header.
  await header.getByRole("button", { name: /log out/i }).click();
  await expect(header.getByRole("button", { name: /log in/i })).toBeVisible();
});

test("login rejects wrong password with inline error", async ({ page }) => {
  await page.goto("/login");
  // The header also has a "Log in" button, so scope the locators to the form.
  const form = page.getByRole("main");
  await form.getByLabel("Email").fill("does-not-exist@nexus.test");
  await form.getByLabel("Password").fill("wrongwrongwrong");
  await form.getByRole("button", { name: /^Log in$/ }).click();

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
});
