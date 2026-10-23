import { expect, test, type Page } from "@playwright/test";
import { seedUnpaidOrder, type SeededOrder } from "./account";
import { loginAsAdmin } from "./admin";
import { visit } from "./visit";

// Requires the ADMIN account bootstrapped by the backend and both servers running.
// `source ../NexusCommerce/.env && npm run test:e2e -- e2e/admin-operations.spec.ts`

type Shopper = { email: string; name: string; token: string };

/**
 * A shopper created over the BFF, just to own what the admin will act on. The token is
 * returned instead of signing the browser in, so the admin login afterwards starts clean.
 */
async function createShopper(page: Page): Promise<Shopper> {
  const stamp = Date.now();
  const email = `pw-admin-ops-${stamp}@nexus.test`;
  const name = `Admin Ops ${stamp}`;
  const password = "correct-horse-battery";

  const created = await page.request.post("/api/v1/users", {
    data: { name, email, phone: "555-0177", password },
  });
  expect(created.ok()).toBeTruthy();

  const login = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const token = ((await login.json()) as { data?: { token?: string } }).data?.token;
  if (!token) throw new Error("Shopper login did not return an access token");

  return { email, name, token };
}

async function seedShopperOrders(page: Page, count: number): Promise<SeededOrder[]> {
  const shopper = await createShopper(page);
  const orders: SeededOrder[] = [];
  for (let index = 0; index < count; index += 1) {
    orders.push(await seedUnpaidOrder(page, shopper.token));
  }
  return orders;
}

function orderRow(page: Page, id: number) {
  const main = page.getByRole("main");
  return main
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: `#${id}`, exact: true }) });
}

test("an admin advances an order and cancels another, and terminal orders offer no actions", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const [forward, doomed] = await seedShopperOrders(page, 2);

  await loginAsAdmin(page);
  await visit(page, "/admin/orders");
  await expect(page.getByRole("heading", { name: "Orders", level: 1 })).toBeVisible();

  // Newest first, so both orders created above sit on the first page.
  const row = orderRow(page, forward.id);
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Mark shipped" }).click();
  await expect(row.getByText("Shipped", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Mark delivered" }).click();
  await expect(row.getByText("Delivered", { exact: true })).toBeVisible();
  await expect(row.getByText("No actions")).toBeVisible();

  const cancelRow = orderRow(page, doomed.id);
  await cancelRow.getByRole("button", { name: "Cancel" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("goes back into stock");
  await expect(dialog).toContainText("No payment was captured");
  await dialog.getByRole("button", { name: "Cancel order" }).click();

  await expect(cancelRow.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(cancelRow.getByText("No actions")).toBeVisible();
});

test("inventory filters sold-out pieces and the adjust dialog round-trips stock", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await loginAsAdmin(page);
  await visit(page, "/admin/inventory");
  await expect(page.getByRole("heading", { name: "Inventory", level: 1 })).toBeVisible();

  const main = page.getByRole("main");
  const firstRow = main.getByRole("row").nth(1);
  await expect(firstRow).toBeVisible();
  const title = (await firstRow.getByRole("cell").first().locator("p").first().innerText()).trim();
  await expect(title).not.toBe("");

  await firstRow.getByRole("button", { name: "Adjust" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: `Adjust stock for ${title}` }),
  ).toBeVisible();

  // A piece with variants stocks each size; one without stocks the piece itself.
  const unitField = dialog.getByLabel("Units on hand");
  const variantField = dialog.getByLabel(/^Stock for /).first();
  const field = (await unitField.count()) > 0 ? unitField : variantField;
  await expect(field).toBeVisible();

  const original = Number(await field.inputValue());
  const bumped = original + 1;
  await field.fill(String(bumped));
  await dialog.getByRole("button", { name: "Save stock" }).click();
  await expect(dialog).toBeHidden();

  await firstRow.getByRole("button", { name: "Adjust" }).click();
  const reopened = page.getByRole("dialog");
  const sameField = (await reopened.getByLabel("Units on hand").count()) > 0
    ? reopened.getByLabel("Units on hand")
    : reopened.getByLabel(/^Stock for /).first();
  await expect(sameField).toHaveValue(String(bumped));

  // Put the seeded catalogue back the way the test found it.
  await sameField.fill(String(original));
  await reopened.getByRole("button", { name: "Save stock" }).click();
  await expect(reopened).toBeHidden();

  const toggle = main.getByRole("button", { name: "Out of stock only" });
  const filtered = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/admin/products") &&
      response.url().includes("outOfStock=true") &&
      response.request().method() === "GET",
  );
  await toggle.click();
  await filtered;
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  // The unfiltered page may come straight from the 30s query cache, so wait on content,
  // not on a network round-trip that may not happen.
  await expect(main.getByRole("row").filter({ hasText: title }).first()).toBeVisible();
});

test("an admin finds a shopper and toggles their access", async ({ page }) => {
  test.setTimeout(120_000);
  const shopper = await createShopper(page);

  const adminEmail = await loginAsAdmin(page);
  await visit(page, "/admin/users");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();

  // The signed-in admin cannot lock themselves out from this table. Search first: the
  // bootstrap account is old enough to sit on a later page.
  await main.getByLabel("Search users").fill(adminEmail);
  await expect(main.getByText("This is you")).toBeVisible();

  await main.getByLabel("Search users").fill(shopper.email);
  const row = main.getByRole("row").filter({ hasText: shopper.email });
  await expect(row).toBeVisible();
  await expect(row.getByText("Shopper", { exact: true })).toBeVisible();
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Disable" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("can no longer sign in");
  await dialog.getByRole("button", { name: "Disable account" }).click();

  await expect(row.getByText("Disabled", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Enable" }).click();
  await expect(row.getByText("Active", { exact: true })).toBeVisible();
});
