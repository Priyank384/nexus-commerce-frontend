import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

// A shaped-but-unsigned token: the client reads claims, Spring verifies the signature.
const TOKEN = [
  "e30",
  btoa(
    JSON.stringify({
      uid: 12,
      sub: "aditi@nexus.test",
      role: "USER",
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  ),
  "sig",
].join(".");

type Call = { path: string; body: Record<string, string> | null };

let calls: Call[] = [];
let passwordStatus = 200;
let loginStatus = 200;

// The API client is built on a same-origin relative baseUrl, which undici cannot parse, so this
// answers fetch directly — the same reason guest-receipt.test.tsx does not use the MSW server.
vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL) => {
    const request = input instanceof Request ? input : new Request(String(input));
    const path = new URL(request.url).pathname;
    const body = request.body
      ? ((await request.json().catch(() => null)) as Record<string, string> | null)
      : null;
    calls.push({ path, body });

    if (path === "/api/auth/refresh") return Response.json({ success: false }, { status: 401 });

    if (path === "/api/v1/users/me/password") {
      return Response.json(
        passwordStatus === 200
          ? { success: true, message: "Password changed", error: null, data: null }
          : {
              success: false,
              message: "Invalid request!",
              error: "Current password is incorrect.",
              data: null,
            },
        { status: passwordStatus },
      );
    }

    if (path === "/api/auth/login") {
      return Response.json(
        loginStatus === 200
          ? { success: true, message: "Signed in", error: null, data: { token: TOKEN } }
          : { success: false, message: "Invalid email or password", error: null, data: null },
        { status: loginStatus },
      );
    }

    return Response.json({ success: true, message: "ok", error: null, data: null });
  }),
);

const { ChangePasswordPanel } = await import("@/components/account/change-password-panel");
const { useSession } = await import("@/lib/auth/session");

function sentTo(path: string) {
  return calls.filter((call) => call.path === path).map((call) => call.body);
}

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ChangePasswordPanel email="aditi@nexus.test" />
    </QueryClientProvider>,
  );
}

async function fill(current: string, next: string, confirm = next) {
  await userEvent.type(screen.getByLabelText(/Current password/i), current);
  await userEvent.type(screen.getByLabelText(/^New password/i), next);
  await userEvent.type(screen.getByLabelText(/Confirm new password/i), confirm);
  await userEvent.click(screen.getByRole("button", { name: /^change password$/i }));
}

describe("ChangePasswordPanel", () => {
  beforeEach(() => {
    calls = [];
    passwordStatus = 200;
    loginStatus = 200;
    push.mockReset();
    useSession.getState().clear();
  });

  it("sends the change and signs this browser straight back in", async () => {
    renderPanel();
    await fill("old-password-1", "new-password-2");

    await waitFor(() => expect(sentTo("/api/auth/login")).toHaveLength(1));
    // Only the two fields the endpoint declares — the confirmation stays in the browser.
    expect(sentTo("/api/v1/users/me/password")[0]).toEqual({
      currentPassword: "old-password-1",
      newPassword: "new-password-2",
    });
    expect(sentTo("/api/auth/login")[0]).toEqual({
      email: "aditi@nexus.test",
      password: "new-password-2",
    });
    expect(useSession.getState().accessToken).toBe(TOKEN);
  });

  it("refuses a mistyped confirmation without costing the account its sessions", async () => {
    renderPanel();
    await fill("old-password-1", "new-password-2", "typed-it-differently");

    await waitFor(() => expect(screen.getByText("Passwords do not match")).toBeInTheDocument());
    expect(sentTo("/api/v1/users/me/password")).toHaveLength(0);
  });

  it("shows why the server said no instead of clearing the form silently", async () => {
    passwordStatus = 401;
    renderPanel();
    await fill("wrong-password-0", "new-password-2");

    await waitFor(() =>
      expect(screen.getByText(/current password is incorrect/i)).toBeInTheDocument(),
    );
    // Nothing changed, so the session this browser holds is still the working one.
    expect(sentTo("/api/auth/login")).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });

  it("signs the shopper out when the change landed but this session could not be re-minted", async () => {
    loginStatus = 401;
    useSession.getState().set(TOKEN);
    renderPanel();
    await fill("old-password-1", "new-password-2");

    await waitFor(() => expect(sentTo("/api/v1/users/me/password")).toHaveLength(1));
    // Every refresh token is gone server-side, so keeping a dead bearer here only lies about
    // being signed in.
    await waitFor(() => expect(useSession.getState().accessToken).toBeNull());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
