import { expect, test } from "@playwright/test";
import { visit } from "./visit";
import { registerNewUser } from "./account";

const ROTATED = "rotated-password-2";

test.describe("account settings", () => {
  test("edits the name on the account and shows it again after a reload", async ({ page }) => {
    await registerNewUser(page, { name: "PW Settings Before" });

    await visit(page, "/account");
    const main = page.getByRole("main");
    await expect(main.getByText("PW Settings Before")).toBeVisible();

    await main.getByRole("button", { name: /^Edit$/ }).click();
    await main.getByLabel("Name", { exact: true }).fill("PW Settings After");
    await main.getByRole("button", { name: /Save changes/ }).click();

    await expect(main.getByText("PW Settings After")).toBeVisible();
    // Back to the read view on its own — a saved detail the page cannot show is a saved detail
    // the shopper will try again.
    await expect(main.getByRole("button", { name: /^Edit$/ })).toBeVisible();

    // Straight to the store: the account row changed, not just this render of it.
    await visit(page, "/account");
    await expect(main.getByText("PW Settings After")).toBeVisible();
  });

  test("refuses a mistyped confirmation before it costs the account its sessions", async ({
    page,
  }) => {
    const account = await registerNewUser(page);
    await visit(page, "/account");
    const main = page.getByRole("main");

    const spent: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/users/me/password")) spent.push(request.url());
    });

    await main.getByLabel("Current password").fill(account.password);
    await main.getByLabel("New password", { exact: true }).fill(ROTATED);
    await main.getByLabel("Confirm new password").fill("typed-it-differently");
    await main.getByRole("button", { name: /^Change password$/ }).click();

    await expect(main.getByText("Passwords do not match")).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 500));
    // One accepted call revokes every refresh token the account holds, so a form that sends a
    // confirmation it already knows is wrong would be signing the shopper out of their devices.
    expect(spent).toHaveLength(0);
  });

  test("changes the password and keeps this browser signed in", async ({ page }) => {
    const account = await registerNewUser(page);
    await visit(page, "/account");
    const main = page.getByRole("main");

    await main.getByLabel("Current password").fill(account.password);
    await main.getByLabel("New password", { exact: true }).fill(ROTATED);
    await main.getByLabel("Confirm new password").fill(ROTATED);
    await main.getByRole("button", { name: /^Change password$/ }).click();

    // The endpoint revokes every session, including this one; the flow re-mints it with the
    // password it just proved, so the header must not fall over.
    await expect(page.locator("header").getByRole("link", { name: "Orders" })).toBeVisible();

    // A reload has no bearer left, so this only renders if the fresh refresh cookie works.
    await visit(page, "/account");
    await expect(main.getByRole("heading", { name: "Good to see you." })).toBeVisible();

    const old = await page.request.post("/api/auth/login", {
      data: { email: account.email, password: account.password },
    });
    expect(old.status()).toBe(401);

    const fresh = await page.request.post("/api/auth/login", {
      data: { email: account.email, password: ROTATED },
    });
    expect(fresh.status()).toBe(200);
  });
});
