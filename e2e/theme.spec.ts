import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("the theme toggle repaints the shell", async ({ page }) => {
  // Pinned so "system" resolves predictably instead of following the runner.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/products");

  const html = page.locator("html");
  const toggle = page.getByRole("banner").getByRole("button", { name: /^Theme:/ });
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await expect(toggle).toHaveAccessibleName("Theme: light. Switch to dark.");
  const lightBg = await background();

  await toggle.click();
  await expect(html).toHaveClass(/dark/);
  const darkBg = await background();
  expect(darkBg).not.toBe(lightBg);

  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Theme: light. Switch to dark.");
  await expect(html).not.toHaveClass(/dark/);
  expect(await background()).toBe(lightBg);
});

test("the choice survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/products");
  const toggle = page.getByRole("banner").getByRole("button", { name: /^Theme:/ });
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});
