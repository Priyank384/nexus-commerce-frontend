import { expect, test, type APIRequestContext } from "@playwright/test";
import { adminCredentials, loginAsAdmin } from "./admin";
import { visit } from "./visit";

// Requires the ADMIN account bootstrapped by the backend and both servers running.
// `source ../NexusCommerce/.env && npm run test:e2e -- e2e/admin.spec.ts`

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "base64",
);

/**
 * A failed assertion must not seed the next run with stray pieces. Teardown goes over the
 * API: clicking the rows used to race the table's own refetch, and any failure before the
 * cleanup left every fixture behind.
 */
async function removeFixtures(request: APIRequestContext) {
  const { email, password } = adminCredentials();
  const login = await request.post("/api/auth/login", { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const token = ((await login.json()) as { data?: { token?: string } }).data?.token;
  expect(token).toBeTruthy();
  const headers = { Authorization: `Bearer ${token}` };

  const list = await request.get("/api/v1/admin/products?size=100&q=E2E%20Linen%20Shirt", { headers });
  expect(list.ok()).toBeTruthy();
  const fixtures = ((await list.json()) as { data?: { content?: { id: number }[] } }).data?.content ?? [];
  for (const fixture of fixtures) {
    // Another run may have removed it between the read and the delete.
    const deleted = await request.delete(`/api/v1/products/${fixture.id}`, { headers });
    expect([200, 204, 404]).toContain(deleted.status());
  }
}

test.afterAll(async ({ request }) => removeFixtures(request));

test("admin lands on a dashboard with live storefront totals", async ({ page }) => {
  await loginAsAdmin(page);
  await visit(page, "/admin");

  await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order pipeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue" })).toBeVisible();

  const adminNav = page.getByRole("navigation", { name: "Admin sections" });
  await expect(adminNav.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(adminNav.getByRole("link", { name: "Products" })).toBeVisible();
});

test("a signed-in shopper is sent away from the admin console", async ({ page }) => {
  const stamp = Date.now();
  await visit(page, "/register");
  const main = page.getByRole("main");
  await main.getByLabel("Name").fill(`Admin Guard ${stamp}`);
  await main.getByLabel("Email").fill(`guard-${stamp}@nexus.test`);
  await main.getByLabel("Phone").fill("555-0110");
  await main.getByLabel("Password").fill("correct-horse-battery");
  await main.getByRole("button", { name: /^Sign up$/ }).click();
  await expect(page).toHaveURL(/\/$/);

  await visit(page, "/admin");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
});

test("an admin builds a nested category, hits the delete guard, and flattens it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await loginAsAdmin(page);
  await visit(page, "/admin/categories");
  await expect(page.getByRole("heading", { name: "Categories", level: 1 })).toBeVisible();

  const stamp = Date.now();
  const parentName = `E2E Category ${stamp}`;
  const childName = `E2E Child ${stamp}`;
  // The storefront nav renders categories too, so assertions stay inside the admin page.
  const main = page.getByRole("main");

  await main.getByRole("button", { name: "New category" }).click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByLabel("Name").fill(parentName);
  await createDialog.getByLabel("Description").fill("Created by the category sweep.");
  await createDialog.getByRole("button", { name: "Create category" }).click();
  await expect(createDialog).toHaveCount(0);
  await expect(main.getByText(parentName, { exact: true })).toBeVisible();

  await main.getByRole("button", { name: `Add a subcategory to ${parentName}` }).click();
  const childDialog = page.getByRole("dialog");
  await expect(childDialog.getByText(`Nested under ${parentName}.`)).toBeVisible();
  await childDialog.getByLabel("Name").fill(childName);
  await childDialog.getByRole("button", { name: "Create category" }).click();
  await expect(main.getByText(childName, { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/admin-categories.png", fullPage: true });

  // The backend refuses to orphan a subtree; the dialog has to surface that reason.
  await main.getByRole("button", { name: `Delete ${parentName}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("still has subcategories");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  // Detaching needs moveToTopLevel on the wire; a missing parentId alone keeps the parent.
  await main.getByRole("button", { name: `Edit ${childName}` }).click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Parent").selectOption({ label: "Top level" });
  await editDialog.getByRole("button", { name: "Save category" }).click();
  await expect(editDialog).toHaveCount(0);

  await main.getByRole("button", { name: `Delete ${parentName}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(main.getByText(parentName, { exact: true })).toHaveCount(0);

  await main.getByRole("button", { name: `Delete ${childName}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(main.getByText(childName, { exact: true })).toHaveCount(0);
});

test("an admin builds a piece with six variants and four images in one submit", async ({ page }) => {
  test.setTimeout(150_000);
  await loginAsAdmin(page);
  await visit(page, "/admin/products");
  await page.getByRole("link", { name: "New product" }).click();
  await expect(page.getByRole("heading", { name: "New product", level: 1 })).toBeVisible();

  const stamp = Date.now();
  const title = `E2E Linen Shirt ${stamp}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill("Created by the admin end-to-end sweep.");
  await page.getByLabel("Price (₹)", { exact: true }).fill("2499");
  await page.getByLabel("Compare-at price (₹)", { exact: true }).fill("3299");
  await page.getByLabel("Category").selectOption({ index: 1 });
  await page.getByLabel("Brand").fill("Plain Thread");
  await page.getByLabel("Material").fill("100% linen");

  // S, M and L are preselected; two colours make the six-row grid.
  await page.getByLabel("Colour 1 name").fill("Olive");
  await page.getByLabel("Colour 1 hex").fill("#6B6B47");
  await page.getByRole("button", { name: "Add colour" }).click();
  await page.getByLabel("Colour 2 name").fill("Clay");
  await page.getByLabel("Colour 2 hex").fill("#A9714B");

  for (const colour of ["Olive", "Clay"]) {
    for (const size of ["S", "M", "L"]) {
      await page.getByLabel(`Stock for ${colour} ${size}`).fill("3");
    }
  }

  await page.getByLabel("Product images").setInputFiles(
    ["front", "back", "detail", "fold"].map((part) => ({
      name: `${part}.png`,
      mimeType: "image/png",
      buffer: PNG,
    })),
  );
  await expect(page.getByText("Thumbnail", { exact: true })).toBeVisible();

  await page.screenshot({ path: "/tmp/admin-product-new.png", fullPage: true });

  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/, { timeout: 45_000 });
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();

  await expect(page.getByRole("button", { name: /^Edit (Olive|Clay) (S|M|L)$/ })).toHaveCount(6);
  for (let index = 1; index <= 4; index += 1) {
    await expect(page.getByRole("button", { name: `Delete image ${index}` })).toBeVisible();
  }

  const reorder = page.waitForResponse(
    (response) => response.url().includes("/images/order") && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Move image 2 up" }).click();
  expect((await reorder).status()).toBe(200);

  await page.screenshot({ path: "/tmp/admin-product-edit.png", fullPage: true });

  // Taking a piece off sale: the blank box has to become an explicit clear on the wire.
  const productId = Number(new URL(page.url()).pathname.split("/").pop());
  const save = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/products/${productId}`) &&
      response.request().method() === "PUT",
  );
  await page.getByLabel("Compare-at price (₹)", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  const saved = (await save).request();
  const body = saved.postDataJSON() as { clearCompareAtPrice?: boolean } | null;
  expect(body, `${saved.method()} ${saved.url()} · ${saved.postData() ?? "no body"}`).not.toBeNull();
  expect(body?.clearCompareAtPrice).toBe(true);

  // Deleting the piece from the table also proves the row goes away. It is on the first
  // page because the catalogue is newest-first.
  await page
    .getByRole("navigation", { name: "Admin sections" })
    .getByRole("link", { name: "Products" })
    .click();
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `Delete ${title}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(row).toHaveCount(0);
});
