import { expect, test } from "@playwright/test";

// The mega-menu is desktop-only; shell.spec.ts runs at 390px. Root links are
// unique by name ("Men" is a substring of "Women", so exact), but several
// subcategories repeat across roots — that is what the panel's role=group
// label is for.
test.use({ viewport: { width: 1440, height: 900 } });

test("hovering a category root reveals its subcategories", async ({ page }) => {
  await page.goto("/products");
  const nav = page.getByRole("navigation", { name: "Primary" });
  const men = nav.getByRole("link", { name: "Men", exact: true });

  await expect(men).toHaveAttribute("href", "/products?category=men");
  await expect(men).toBeVisible();

  const panel = nav.getByRole("group", { name: "Men categories" });
  await expect(panel).toBeHidden();

  await men.hover();
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "T-Shirts" })).toHaveAttribute(
    "href",
    "/products?category=mens-t-shirts",
  );
  await expect(panel.getByRole("link", { name: "Activewear" })).toBeVisible();
});

test("the mega-menu is reachable from the keyboard", async ({ page }) => {
  await page.goto("/products");
  const panel = page.getByRole("group", { name: "Women categories" });
  await expect(panel).toBeHidden();
  await page.getByRole("link", { name: "Women", exact: true }).focus();
  await expect(panel).toBeVisible();
});
