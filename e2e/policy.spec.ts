import { expect, test } from "@playwright/test";
import { visit } from "./visit";

const PAGES = [
  { path: "/returns", heading: "Returns and refunds" },
  { path: "/shipping", heading: "Shipping and delivery" },
  { path: "/size-guide", heading: "Size guide" },
  { path: "/contact", heading: "Contact" },
] as const;

/**
 * The trust pages have no data to fetch and nobody to sign in as, so what can break is that they
 * are wrong: an unreachable route, a page that bounces an anonymous shopper to /login, or a link
 * that leads nowhere. Each case checks the route answers, the copy a shopper would act on is
 * actually on it, and every internal link it offers resolves.
 */
for (const { path, heading } of PAGES) {
  test(`${path} renders for an anonymous shopper and offers only links that exist`, async ({
    page,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("header[data-hydrated='true']")).toBeAttached();

    await expect(
      page.getByRole("main").getByRole("heading", { name: heading, level: 1 }),
    ).toBeVisible();

    // One section heading per promise, so the page is scannable rather than a wall.
    await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toBeVisible();

    const internal = (
      await page
        .getByRole("main")
        .locator('a[href^="/"]')
        .evaluateAll((links) =>
          links
            .map((link) => link.getAttribute("href") ?? "")
            // Only bare routes: a query-routed catalogue page is a list, not a destination this
            // page is promising, and a mailto is checked by the case below.
            .filter((href) => !href.includes("?")),
        )
    ).filter((href, index, all) => all.indexOf(href) === index);

    expect(internal.length).toBeGreaterThan(0);
    for (const href of internal) {
      const linked = await page.context().request.get(href);
      // 401/403 would mean a page meant for a shopper is gated behind the API, and a 404 means the
      // trust page promises a destination that does not exist.
      expect([200, 307, 308], `${href} is not reachable`).toContain(linked.status());
    }
  });
}

test("the pages say what the store actually does", async ({ page }) => {
  await visit(page, "/shipping");
  // Checkout adds no delivery fee, so the page has to say so — this is the claim a shopper
  // reconciles against their bank statement.
  await expect(page.getByRole("main")).toContainText(/no delivery fee|Free, and not as a promotion/i);

  await visit(page, "/returns");
  await expect(page.getByRole("main")).toContainText(/14 days/);
  // There is no returns endpoint, so the page must not offer one.
  await expect(page.getByRole("button", { name: /return this order/i })).toHaveCount(0);

  await visit(page, "/size-guide");
  // The table is the store's grading block, not a measurement of the photographed garment, and the
  // page has to say so — the product page's fit dialog quotes the same numbers.
  await expect(page.getByRole("main")).toContainText(/blocks our sizes are graded from/i);
  await expect(page.getByRole("main")).toContainText(/not measurements of the garment/i);

  await visit(page, "/contact");
  // No inquiry endpoint exists, so there must be no form pretending to send one.
  await expect(page.getByRole("main").locator("form")).toHaveCount(0);
});

test("the footer reaches every policy page", async ({ page }) => {
  await visit(page, "/");
  const footer = page.getByRole("contentinfo");
  for (const { path, label } of [
    { path: "/returns", label: "Returns and refunds" },
    { path: "/shipping", label: "Shipping and delivery" },
    { path: "/size-guide", label: "Size guide" },
    { path: "/contact", label: "Contact" },
  ]) {
    await expect(footer.getByRole("link", { name: label })).toHaveAttribute("href", path);
  }
});

test("the sitemap offers them to a crawler", async ({ request }) => {
  const body = await (await request.get("/sitemap.xml")).text();
  for (const { path } of PAGES) expect(body).toContain(path);
});

test("a product page's fit dialog leads to the same numbers the guide publishes", async ({
  page,
}) => {
  await visit(page, "/products");
  await page.getByRole("main").locator('a[href^="/products/"]').first().click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 30_000 });

  const fit = page.getByRole("button", { name: /fit guide/i });
  if (!(await fit.count())) test.skip(); // a single-size piece has no size picker to explain
  await fit.click();

  const dialog = page.getByRole("dialog", { name: /fit guide/i });
  await expect(dialog).toBeVisible();
  // One row out of the shared table, to prove the dialog and the page read the same source.
  await expect(dialog).toContainText("40–42");
  await dialog.getByRole("link", { name: /how to pick a size/i }).click();
  await expect(page).toHaveURL(/\/size-guide$/);
  await expect(page.getByRole("heading", { level: 2, name: /what each size measures/i })).toBeVisible();
});
