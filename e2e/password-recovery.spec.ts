import { expect, test } from "@playwright/test";
import { visit } from "./visit";
import { registerNewUser } from "./account";
import { readResetToken, resetTokenExists } from "./reset-token";

// Without the store the mailed token is unreadable, so only the live half of the flow needs it.
const hasRedis = !!process.env.REDIS_URL;

function uidOf(jwt: string): number {
  const payload = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return (JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as { uid: number }).uid;
}

async function waitForToken(userId: number): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const token = await readResetToken(userId);
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`no reset token was written for user ${userId}`);
}

test.describe("password recovery", () => {
  test("the sign-in page offers the way back in", async ({ page }) => {
    await visit(page, "/login");
    await expect(
      page.getByRole("main").getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  test("an address with no account is answered exactly like one with an account", async ({
    page,
  }) => {
    const email = `pw-nobody-${Date.now()}@nexus.test`;
    await visit(page, "/forgot-password");
    const main = page.getByRole("main");

    await main.getByLabel("Email").fill(email);
    await main.getByRole("button", { name: "Send reset link" }).click();

    await expect(main.getByRole("heading", { name: new RegExp(`Check .*${email}`) })).toBeVisible();
    await expect(main.getByText(/works once and expires in fifteen minutes/i)).toBeVisible();
    // Any wording that distinguishes a stranger's address from a real one turns this form into
    // a directory of who shops here.
    await expect(main.getByText(/no account|not registered|doesn.t exist/i)).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Send reset link" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Back to sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  test("a reset page opened without a token never shows the form", async ({ page }) => {
    await visit(page, "/auth/reset-password");
    const main = page.getByRole("main");

    await expect(main.getByRole("heading", { name: "This link will not work" })).toBeVisible();
    await expect(main.getByLabel("New password")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Send a new reset link" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  test.skip(!hasRedis, "no REDIS_URL: the token the mail would have carried cannot be read");

  test("a shopper who cannot sign in gets a link, sets a new password and comes back in", async ({
    page,
  }) => {
    const account = await registerNewUser(page);
    const uid = uidOf(account.token);

    // Sign in first: the reset has to evict a session this browser is actively holding, and a
    // jar that never had anything in it would pass the check further down no matter what.
    await visit(page, "/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator("header").getByRole("link", { name: "Orders" })).toBeVisible();
    expect((await page.context().cookies()).some((cookie) => cookie.name === "rc" && cookie.value)).toBe(true);

    await visit(page, "/forgot-password");
    const main = page.getByRole("main");
    await main.getByLabel("Email").fill(account.email);
    await main.getByRole("button", { name: "Send reset link" }).click();
    await expect(main.getByRole("heading", { name: /Check / })).toBeVisible();

    const token = await waitForToken(uid);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // This is the URL the mailer builds, so the path here is the contract with the email.
    await visit(page, `/auth/reset-password?token=${token}`);
    await expect(main.getByRole("heading", { name: "Choose a new password" })).toBeVisible();

    const spent: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/reset-password")) spent.push(request.url());
    });

    const newPassword = "second-password-9";
    // exact, or "New password" also matches "Confirm new password".
    await main.getByLabel("New password", { exact: true }).fill(newPassword);
    await main.getByLabel("Confirm new password").fill("typed-it-differently");
    await main.getByRole("button", { name: "Set new password" }).click();

    // A mistyped confirmation has to cost a retyped field, not the single-use link.
    await expect(main.getByText("Passwords do not match")).toBeVisible();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(spent).toHaveLength(0);

    await main.getByLabel("Confirm new password").fill(newPassword);
    await main.getByRole("button", { name: "Set new password" }).click();
    await expect(main.getByRole("heading", { name: "New password set" })).toBeVisible();

    // The backend revokes every refresh token on a reset, so the session this browser signed
    // in with is already dead even though the header still looks logged in. The BFF has to
    // clear the jar so the UI tells the truth about the next step, which is signing in again.
    const jar = await page.context().cookies();
    expect(jar.filter((cookie) => cookie.name === "rc" && cookie.value)).toHaveLength(0);
    expect(jar.filter((cookie) => cookie.name === "has_session" && cookie.value)).toHaveLength(0);

    // The token is spent in the store, so the link in the email is dead for good. The page cannot
    // know that before being told, so the second visit shows the form and the answer arrives on
    // submit — which is the point: a shopper must not be left retyping a password on a dead link.
    await expect(resetTokenExists(token)).resolves.toBe(false);
    await visit(page, `/auth/reset-password?token=${token}`);
    await main.getByLabel("New password", { exact: true }).fill("third-password-7");
    await main.getByLabel("Confirm new password").fill("third-password-7");
    await main.getByRole("button", { name: "Set new password" }).click();

    await expect(main.getByRole("heading", { name: "This link will not work" })).toBeVisible();
    await expect(main.getByText(/invalid, has expired, or has already been used/i)).toBeVisible();
    await expect(main.getByRole("link", { name: "Send a new reset link" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );

    await visit(page, "/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();

    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.locator("header").getByRole("link", { name: "Orders" })).toBeVisible();
  });
});
