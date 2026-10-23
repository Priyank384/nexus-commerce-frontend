import { expect, test } from "@playwright/test";
import { visit } from "./visit";

// The catalogue is server-rendered and every filter is a link or a GET form, so these specs
// assert on navigation and DOM state rather than on any client store.
test.describe("catalogue listing", () => {
  test("title and count follow the filters in the URL", async ({ page }) => {
    await visit(page, "/products?gender=men");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Menswear");
    await expect(page.getByText(/pieces$/)).toBeVisible();

    // A category slug is narrower than its department.
    await page.getByRole("link", { name: "Denim" }).first().click();
    await expect(page).toHaveURL(/category=mens-denim/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The collection");
  });

  test("size chips toggle on and off without losing the other facets", async ({ page }) => {
    await visit(page, "/products?gender=men");
    const large = page.getByRole("link", { name: "L", exact: true });
    await large.click();
    await expect(page).toHaveURL(/gender=men&sizes=l/);
    await expect(page.getByRole("link", { name: "L", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Adding a colour keeps the size, and clearing the size keeps the colour.
    await page.getByRole("link", { name: "Bone", exact: true }).click();
    await expect(page).toHaveURL(/sizes=l&colors=bone/);
    await page.getByRole("link", { name: "L", exact: true }).click();
    await expect(page).toHaveURL(/colors=bone/);
    await expect(page).not.toHaveURL(/sizes=/);
  });

  test("sorting is a form submit, not a client re-sort", async ({ page }) => {
    await visit(page, "/products");
    await page.getByLabel("Sort by").selectOption("price,desc");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/sort=price%2Cdesc/);

    const firstPrice = await page.locator('main a[href^="/products/"]').first().innerText();
    expect(firstPrice).toContain("12,990");
  });

  test("pagination keeps the facets and marks the current page", async ({ page }) => {
    // 15 menswear pieces at 4 per page; a facet has to survive the hop to page 2.
    await visit(page, "/products?gender=men&size=4");
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/gender=men.*page=1/);
    // Scoped to the pagination nav: "2" is also a substring of every product card's price.
    const pager = page.getByRole("navigation", { name: "Pagination" });
    await expect(pager.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
    await expect(pager.getByRole("link", { name: "Previous" })).toBeVisible();
  });

  test("an impossible combination says so and offers a way out", async ({ page }) => {
    await visit(page, "/products?keyword=zzzzz");
    await expect(page.getByText("Nothing matches those filters")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test("the header search reaches the same listing", async ({ page }) => {
    await visit(page, "/");
    await page.getByRole("search").getByLabel("Search products").fill("cashmere");
    await page.getByRole("search").getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/keyword=cashmere/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("“cashmere”");
    await expect(page.locator('a[href^="/products/"]')).not.toHaveCount(0);
  });
});

test.describe("home", () => {
  test("hero, departments and new arrivals all render", async ({ page }) => {
    await visit(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Considered staples");
    await expect(page.getByRole("img", { name: "Plain Thread autumn collection" })).toBeVisible();

    const departments = page.getByRole("region", { name: "Departments" });
    await expect(departments.getByRole("link", { name: /^Men$/ })).toHaveAttribute(
      "href",
      "/products?category=men",
    );
    await expect(departments.getByRole("link", { name: "Knitwear" })).toHaveCount(2);

    const news = page.getByRole("region", { name: /New in/ });
    // The section heading carries a "See all" link too, so count the product cards by href.
    await expect(news.locator('a[href^="/products/"]')).toHaveCount(4);
  });
});
