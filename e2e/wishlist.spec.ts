import { expect, test } from "@playwright/test";
import { registerNewUser } from "./account";
import { visit } from "./visit";

test("the heart saves a piece and the account lists it", async ({ page }) => {
  await registerNewUser(page);
  await visit(page, "/products");

  const main = page.getByRole("main");
  // The listing's first product link, captured before the heart click so the href is stable.
  const firstCard = main.locator('a[href^="/products/"]').first();
  const href = await firstCard.getAttribute("href");
  const title = (await firstCard.locator("h3").first().textContent())?.trim() ?? "";
  expect(href).toBeTruthy();
  expect(title).toBeTruthy();

  const heart = main.getByRole("button", { name: "Save to wishlist" }).first();
  await heart.click();
  await expect(main.getByRole("button", { name: "Remove from wishlist" }).first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // A full navigation drops the in-memory token; the PDP heart proves the state came back
  // from the server rather than from the listing's cache.
  await visit(page, href!);
  await expect(
    page.getByRole("main").getByRole("button", { name: "Remove from wishlist" }),
  ).toBeVisible();

  await visit(page, "/account");
  const accountMain = page.getByRole("main");
  await accountMain.getByRole("tab", { name: "Saved pieces" }).click();
  await expect(accountMain.getByText("1 piece, kept across devices.")).toBeVisible();

  const savedCard = accountMain.getByRole("listitem").filter({ hasText: title });
  await expect(savedCard).toBeVisible();
  await savedCard
    .getByRole("button", { name: new RegExp(`Remove ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} from saved pieces`) })
    .click();

  await expect(accountMain.getByText("Nothing saved yet. Tap the heart on any piece to keep it here.")).toBeVisible();
});
