import { expect, test } from "@playwright/test";
import { registerNewUser, seedUnpaidOrder } from "./account";
import { settleOrder } from "./razorpay";
import { visit } from "./visit";

// Settling the seeded order creates a real Razorpay test-mode intent, so this spec is opt-in
// like live-payment.spec.ts: `LIVE_PAYMENT=1 npx playwright test e2e/reviews.spec.ts`.
const enabled = process.env.LIVE_PAYMENT === "1";

test.describe("reviews", () => {
  test.skip(!enabled, "Set LIVE_PAYMENT=1 to settle the seeded order through Razorpay");

  test("a verified buyer reviews a paid piece and the catalogue rating moves", async ({ page }) => {
    test.setTimeout(180_000);

    const account = await registerNewUser(page, { name: "Asha Rao" });
    const order = await seedUnpaidOrder(page, account.token);
    await settleOrder(page, account.token, order);

    const productResponse = await page.request.get("/api/v1/products/1101");
    expect(productResponse.ok()).toBeTruthy();
    const product = (await productResponse.json()) as {
      data: { id: number; slug: string; title: string; rating: number; reviewCount: number };
    };
    const before = { rating: product.data.rating, reviewCount: product.data.reviewCount ?? 0 };

    await visit(page, `/products/${product.data.slug}`);
    const main = page.getByRole("main");

    // Only a verified purchase unlocks the form; the gate is the paid order, not the session.
    await main.getByRole("button", { name: "Write a review" }).click();
    const dialog = page.getByRole("dialog", { name: `Review ${product.data.title}` });
    await dialog.getByRole("button", { name: "4 stars" }).click();
    const comment = `E2E fit note ${Date.now()}`;
    await dialog.getByLabel("Your review · optional").fill(comment);
    await dialog.getByRole("button", { name: "Post review" }).click();
    await expect(dialog).toBeHidden();

    // The list refetches; the reviewer is shortened to first name + surname initial.
    await expect(main.getByText(comment)).toBeVisible();
    await expect(main.getByText("Asha R.").first()).toBeVisible();
    const heading = main.getByRole("region", { name: "Reviews" });
    await expect(heading.getByText(new RegExp(`\\b${before.reviewCount + 1} review`))).toBeVisible();

    // The same purchase cannot be reviewed twice, so the form disappears for this product.
    await expect(main.getByRole("button", { name: "Write a review" })).toHaveCount(0);
    await expect(main.getByText("Reviews come from verified buyers, one per purchase.")).toBeVisible();

    const afterResponse = await page.request.get("/api/v1/products/1101");
    const after = (await afterResponse.json()) as {
      data: { rating: number; reviewCount: number };
    };
    expect(after.data.reviewCount).toBe(before.reviewCount + 1);
    expect(after.data.rating).toBeGreaterThan(0);

    // And the review survives a full reload, served from the database rather than cache.
    await visit(page, `/products/${product.data.slug}`);
    await expect(page.getByRole("main").getByText(comment)).toBeVisible();
  });
});
