import { expect, test } from "@playwright/test";
import { addFirstProductToBag, registerNewUser } from "./account";

test("bag page: quantity changes update the total, remove empties the bag", async ({ page }) => {
  await registerNewUser(page);
  await addFirstProductToBag(page);

  await page
    .getByRole("dialog", { name: "Your bag" })
    .getByRole("link", { name: "View bag" })
    .click();
  await expect(page).toHaveURL(/\/cart$/);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Your bag" })).toBeVisible();

  const line = main
    .locator("li")
    .filter({ has: page.getByRole("button", { name: /Increase quantity of/ }) })
    .first();
  const quantity = line.locator("span[aria-live='polite']");
  const subtotal = main.locator("dl").filter({ hasText: "Subtotal" }).locator("dd").first();

  await expect(quantity).toHaveText("1");
  const before = await subtotal.innerText();

  await line.getByRole("button", { name: /Increase quantity of/ }).click();
  await expect(quantity).toHaveText("2");
  await expect(subtotal).not.toHaveText(before);

  await line.getByRole("button", { name: /Remove .* from bag/ }).click();
  await expect(main.getByRole("heading", { name: "Your bag is empty" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Browse the collection" })).toBeVisible();
});
