import { expect, test } from "@playwright/test";
import { visit } from "./visit";

// The shell collapses to a disclosure menu below md, which no desktop-viewport
// spec exercises. This one runs at 390px so the hamburger path stays honest.
test.use({ viewport: { width: 390, height: 844 } });

test("mobile menu opens and closes", async ({ page }) => {
  await visit(page, "/products");
  const header = page.getByRole("banner");
  // Scoped to the panel: the desktop nav holds the same links, hidden at this width.
  const menu = header.getByRole("navigation", { name: "Mobile" });

  await expect(menu).toBeHidden();
  await header.getByRole("button", { name: "Open menu" }).click();
  // exact: "Men" is a substring of "Women".
  await expect(menu.getByRole("link", { name: "Men", exact: true })).toBeVisible();
  // Subcategories are nested inline in the accordion, not behind a second tap.
  await expect(menu.getByRole("link", { name: "T-Shirts" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Sign up" })).toBeVisible();

  await header.getByRole("button", { name: "Close menu" }).click();
  await expect(menu).toBeHidden();
});

test("wordmark and page body share one left edge", async ({ page }) => {
  await visit(page, "/products");
  const wordmark = await page.getByRole("link", { name: /nexus commerce/i }).boundingBox();
  // The listing titles itself from the filters (Everything, Menswear, a collection…).
  const heading = await page.getByRole("heading", { level: 1 }).first().boundingBox();
  expect(wordmark?.x).toBeCloseTo(heading?.x ?? -1, 0);
});
