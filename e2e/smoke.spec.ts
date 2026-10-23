import { expect, test } from "@playwright/test";
import { visit } from "./visit";

// Phase 3 replaced the Phase 0 stubs: home is a real landing page and /products is the
// faceted listing. This spec only checks that both routes still reach Spring through the BFF.
test("home renders the hero and its call to action", async ({ page }) => {
  await visit(page, "/");
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Considered staples");
  await expect(page.getByRole("link", { name: "Shop the collection" })).toHaveAttribute(
    "href",
    "/products",
  );
  await expect(page.getByRole("link", { name: /plain thread/i })).toBeVisible();
});

test("listing renders seeded products from the backend", async ({ page }) => {
  await visit(page, "/products");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Everything");
  await expect(page.getByRole("link", { name: /Organic Cotton Crew Tee/ }).first()).toHaveAttribute(
    "href",
    "/products/organic-cotton-crew-tee",
  );
});

test("login page renders", async ({ page }) => {
  await visit(page, "/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
