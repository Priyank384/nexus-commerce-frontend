import { expect, test } from "@playwright/test";

// Phase 0 smoke: homepage redirects to /products, header renders,
// BFF proxy reaches Spring (products placeholder page loaded via (public) group).
test("home redirects to /products", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.getByRole("link", { name: /plain thread/i })).toBeVisible();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
