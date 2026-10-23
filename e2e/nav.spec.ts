import { expect, test } from "@playwright/test";
import { visit } from "./visit";

// The mega-menu is desktop-only; shell.spec.ts runs at 390px. Root links are
// unique by name ("Men" is a substring of "Women", so exact), but several
// subcategories repeat across roots — that is what the panel's role=group
// label is for.
test.use({ viewport: { width: 1440, height: 900 } });

test("hovering a category root reveals its subcategories", async ({ page }) => {
  await visit(page, "/products");
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
  await visit(page, "/products");
  // Scoped to the nav: the filter sidebar and the footer link the same departments, and a
  // page-wide locator would resolve to more than one "Women".
  const nav = page.getByRole("navigation", { name: "Primary" });
  const panel = nav.getByRole("group", { name: "Women categories" });
  await expect(panel).toBeHidden();
  await nav.getByRole("link", { name: "Women", exact: true }).focus();
  await expect(panel).toBeVisible();
});
