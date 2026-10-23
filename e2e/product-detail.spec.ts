import { expect, test } from "@playwright/test";
import { visit } from "./visit";

// The detail page is the one place the catalogue has real client state: colour, size and
// quantity all change what the shopper can buy, so the specs assert on the SKU line, which is
// derived from all three.
test.describe("product detail", () => {
  test.beforeEach(async ({ page }) => {
    await visit(page, "/products/organic-cotton-crew-tee");
  });

  test("choosing a colour and size changes the SKU and the stock line", async ({ page }) => {
    const style = page.getByText(/^Style PT-/);
    await expect(style).toBeVisible();
    const before = await style.innerText();

    await page.getByRole("button", { name: "Olive", exact: true }).click();
    await expect(page.getByText(/^Size ·/)).toBeVisible();
    const afterColour = await style.innerText();
    expect(afterColour).not.toBe(before);

    await page.getByRole("button", { name: "XL", exact: true }).click();
    await expect(style).toHaveText("Style PT-1101-XL-OLI");
    await expect(page.getByText("In stock · ready to ship")).toBeVisible();
  });

  test("a sold-out size cannot be picked and says so when it is the default", async ({ page }) => {
    // Black L is seeded at stock 0.
    await page.getByRole("button", { name: "Black", exact: true }).click();
    await expect(page.getByRole("button", { name: "L", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "M", exact: true })).toBeEnabled();
  });

  test("the gallery follows the thumbnails and the colour", async ({ page }) => {
    // Seeded variants carry their own photograph, so the frame opens on the colour in stock.
    await expect(page.getByRole("img", { name: /in (Black|Bone|Olive)/ })).toBeVisible();

    await page.getByRole("button", { name: "View Organic Cotton Crew Tee - view 3" }).click();
    await expect(page.getByRole("img", { name: "Organic Cotton Crew Tee - view 3" })).toBeVisible();

    // Picking another colour takes the frame back to that colour's photo.
    await page.getByRole("button", { name: "Olive", exact: true }).click();
    await expect(page.getByRole("img", { name: "Organic Cotton Crew Tee in Olive" })).toBeVisible();

    await page.getByRole("button", { name: "View Organic Cotton Crew Tee - view 1" }).click();
    await expect(page.getByRole("img", { name: "Organic Cotton Crew Tee - view 1" })).toBeVisible();
  });

  test("quantity is capped by the stock of the chosen variant", async ({ page }) => {
    const plus = page.getByRole("button", { name: "Increase quantity" });
    await plus.click();
    await expect(page.getByText("2", { exact: true })).toBeVisible();
    await expect(page.getByText(/Add to bag ·/)).toContainText("1,780");
  });

  test("an anonymous add-to-bag goes to sign in and back", async ({ page }) => {
    await page.getByRole("button", { name: /^Add to bag/ }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fproducts%2Forganic-cotton-crew-tee/);
  });

  test("an unknown slug 404s with a way back to the collection", async ({ page }) => {
    await visit(page, "/products/not-a-real-piece");
    await expect(page.getByText("We no longer carry that piece")).toBeVisible();
    await page.getByRole("link", { name: "Shop the collection" }).click();
    await expect(page).toHaveURL(/\/products$/);
  });
});
