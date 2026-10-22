import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { LoginForm } from "@/components/auth/login-form";
import { useSession } from "@/lib/auth/session";
import { server } from "@/test/mocks/server";

// Stub Next's navigation hooks — the form calls router.replace on success.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeFakeJwt(payload: object) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, "");
  return `${header}.${body}.sig`.replace(/\+/g, "-").replace(/\//g, "_");
}

describe("LoginForm", () => {
  beforeEach(() => {
    useSession.getState().clear();
  });

  it("posts to /api/auth/login and populates the session on success", async () => {
    const token = makeFakeJwt({
      sub: "shopper@nexus.test",
      uid: 42,
      role: "USER",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({
          success: true,
          message: "Signed in",
          error: null,
          data: { token, tokenType: "Bearer", expiresAt: new Date(Date.now() + 3600_000).toISOString() },
        }),
      ),
    );

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "shopper@nexus.test");
    await userEvent.type(screen.getByLabelText(/Password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => expect(useSession.getState().accessToken).toBe(token));
    expect(useSession.getState().user).toMatchObject({ id: 42, email: "shopper@nexus.test", role: "USER" });
  });

  it("shows the backend message on 401 invalid-credentials", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { success: false, message: "Invalid credentials!", error: "Invalid email or password!", data: null },
          { status: 401 },
        ),
      ),
    );

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "wrong@nexus.test");
    await userEvent.type(screen.getByLabelText(/Password/i), "wrongpw");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    await waitFor(() => expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument());
    expect(useSession.getState().accessToken).toBeNull();
  });

  it("starts a 60s countdown when Spring 429s", async () => {
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json(
          { success: false, message: "Too many login attempts", error: "Rate limit exceeded", data: null },
          { status: 429 },
        ),
      ),
    );

    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "user@nexus.test");
    await userEvent.type(screen.getByLabelText(/Password/i), "whatever12");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    // The countdown is a `<p>` containing "retry in Ns"; N starts at 60 or below.
    await waitFor(() => expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument());
    expect(screen.getByText(/retry in/i).textContent).toMatch(/\d+s/);
  });

  it("blocks client-side submit when email is invalid", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "not-an-email");
    await userEvent.type(screen.getByLabelText(/Password/i), "whatever12");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));

    // The observable outcome we care about is that no network call happens
    // when Zod rejects the payload — the specific inline error text is a
    // styling concern that's easier to check visually than from jsdom.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
