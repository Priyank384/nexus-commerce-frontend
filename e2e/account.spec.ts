import { expect, test } from "@playwright/test";
import { registerNewUser } from "./account";
import { visit } from "./visit";

test("the account hub shows the profile and keeps an address book", async ({ page }) => {
  const account = await registerNewUser(page);
  await visit(page, "/account");

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Good to see you." })).toBeVisible();

  // Profile is read from GET /users/me, not from the session snapshot.
  await expect(main.getByText(account.name)).toBeVisible();
  await expect(main.getByText(account.email)).toBeVisible();

  await main.getByRole("tab", { name: "Addresses" }).click();
  await expect(main.getByText("No addresses yet. Add one so checkout can use it.")).toBeVisible();

  await main.getByRole("button", { name: "Add address" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add address" });
  await addDialog.getByLabel("Label").fill("Work");
  await addDialog.getByLabel("Recipient name").fill("Asha Rao");
  await addDialog.getByLabel("Address line 1").fill("14 Lavelle Road");
  await addDialog.getByLabel("Address line 2 (optional)").fill("Indiranagar");
  await addDialog.getByLabel("City").fill("Bengaluru");
  await addDialog.getByLabel("State").fill("Karnataka");
  await addDialog.getByLabel("PIN code").fill("560038");
  await addDialog.getByLabel("Phone").fill("9800000000");
  await addDialog.getByRole("button", { name: "Save address" }).click();
  await expect(addDialog).toBeHidden();

  const first = main.getByRole("listitem").filter({ hasText: "Asha Rao" });
  await expect(first).toContainText("Work");
  await expect(first.getByText("Default", { exact: true })).toBeVisible();

  // PUT replaces every field, so the defaults ride along untouched.
  await first.getByRole("button", { name: "Edit" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit address" });
  await editDialog.getByLabel("Label").fill("Studio");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).toBeHidden();
  await expect(main.getByRole("listitem").filter({ hasText: "Asha Rao" })).toContainText("Studio");

  await main.getByRole("button", { name: "Add address" }).click();
  const secondDialog = page.getByRole("dialog", { name: "Add address" });
  await secondDialog.getByLabel("Recipient name").fill("Ravi Kulkarni");
  await secondDialog.getByLabel("Address line 1").fill("9 Brigade Road");
  await secondDialog.getByLabel("City").fill("Bengaluru");
  await secondDialog.getByLabel("State").fill("Karnataka");
  await secondDialog.getByLabel("PIN code").fill("560001");
  await secondDialog.getByLabel("Phone").fill("9800000001");
  await secondDialog.getByRole("button", { name: "Save address" }).click();
  await expect(secondDialog).toBeHidden();

  const second = main.getByRole("listitem").filter({ hasText: "Ravi Kulkarni" });
  await expect(second.getByText("Default", { exact: true })).toHaveCount(0);
  await second.getByRole("button", { name: "Make default" }).click();
  await expect(second.getByText("Default", { exact: true })).toBeVisible();
  await expect(first.getByText("Default", { exact: true })).toHaveCount(0);

  await first.getByRole("button", { name: "Delete" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete this address?" });
  await deleteDialog.getByRole("button", { name: "Delete" }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(main.getByRole("listitem").filter({ hasText: "Asha Rao" })).toHaveCount(0);
  await expect(main.getByRole("listitem").filter({ hasText: "Ravi Kulkarni" })).toBeVisible();
});
