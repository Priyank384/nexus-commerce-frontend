import { expect, test } from "@playwright/test";
import { adminCredentials } from "./admin";
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

  test("a colour with nothing left cannot be picked or bought", async ({ page, request }) => {
    test.setTimeout(120_000);
    // Stock drifts — checkout consumes it and the inventory specs restock it — so seed the
    // premise over the admin API and put the numbers back when the assertions are done.
    const { email, password } = adminCredentials();
    const login = await request.post("/api/auth/login", { data: { email, password } });
    expect(login.ok()).toBeTruthy();
    const token = ((await login.json()) as { data?: { token?: string } }).data?.token;
    expect(token).toBeTruthy();

    const variantsResponse = await request.get("/api/v1/products/1101/variants");
    const variants = ((await variantsResponse.json()) as {
      data: { id: number; size: string; colorName: string; stock: number }[];
    }).data;
    const black = variants.filter((entry) => entry.colorName === "Black");
    expect(black.length).toBeGreaterThan(1);

    const setStock = (id: number, stock: number) =>
      request.put(`/api/v1/products/variants/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { stock },
      });
    // The backend evicts its cached product read after the write commits; that eviction can
    // land a moment after the PUT responds, so wait for the read the storefront will make.
    const slugStock = async () => {
      const response = await request.get("/api/v1/products/slug/organic-cotton-crew-tee");
      const body = (await response.json()) as {
        data: { variants: { id: number; stock: number }[] };
      };
      const byId = new Map(body.data.variants.map((entry) => [entry.id, entry.stock]));
      return black.map((entry) => byId.get(entry.id) ?? null);
    };

    try {
      for (const entry of black) expect((await setStock(entry.id, 0)).ok()).toBeTruthy();
      await expect.poll(slugStock, { timeout: 15_000 }).toEqual(black.map(() => 0));

      // The page opens on the first colour still in stock, so the empty one is picked by hand.
      await visit(page, "/products/organic-cotton-crew-tee");
      await page.getByRole("button", { name: "Black", exact: true }).click();
      await expect(page.getByText(/^Sold out in Black · /)).toBeVisible();
      for (const entry of black) {
        // A sold-out button carries a screen-reader suffix, so match its prefix.
        await expect(page.getByRole("button", { name: new RegExp(`^${entry.size}( |$)`) })).toBeDisabled();
      }
      await expect(page.getByRole("button", { name: "Sold out", exact: true })).toBeDisabled();
    } finally {
      for (const entry of black) {
        expect((await setStock(entry.id, entry.stock)).ok()).toBeTruthy();
      }
      await expect
        .poll(slugStock, { timeout: 15_000 })
        .toEqual(black.map((entry) => entry.stock));
    }
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
