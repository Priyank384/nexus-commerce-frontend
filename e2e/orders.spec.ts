import { expect, test } from "@playwright/test";
import { registerNewUser, seedUnpaidOrder } from "./account";
import { visit } from "./visit";

test("order history shows the address and variant snapshots, and offers payment", async ({
  page,
}) => {
  const account = await registerNewUser(page);
  const order = await seedUnpaidOrder(page, account.token);

  await visit(page, "/orders");
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Orders" })).toBeVisible();
  await expect(main.getByText("Awaiting payment").first()).toBeVisible();

  const row = main.getByRole("link").filter({ hasText: `Order #${order.id}` });
  await expect(row).toContainText("₹");
  await row.click();

  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}$`));
  await expect(main.getByRole("heading", { name: `#${order.id}` })).toBeVisible();

  // The address is read from the JSON snapshot frozen at checkout, not the address book.
  await expect(main.getByText("Asha Rao")).toBeVisible();
  await expect(main.getByText("14 Lavelle Road, Indiranagar")).toBeVisible();
  await expect(main.getByText("Bengaluru, Karnataka, 560038")).toBeVisible();

  // Variant identity was snapshotted with the line item.
  await expect(
    main.getByText(`${order.variantColorName} · ${order.variantSize}`),
  ).toBeVisible();

  // Status shows twice by design (header + payment card); the router also keeps the
  // cached list segment in the DOM, so scope to the aside rather than .first().
  await expect(
    main.getByRole("complementary").getByText("Awaiting payment"),
  ).toBeVisible();
  await expect(main.getByRole("button", { name: /^Pay ₹/ })).toBeVisible();
});
