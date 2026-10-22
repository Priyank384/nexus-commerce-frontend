import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { RegisterForm } from "@/components/auth/register-form";
import { useSession } from "@/lib/auth/session";
import { server } from "@/test/mocks/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeFakeJwt(payload: object) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=+$/, "");
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, "");
  return `${header}.${body}.sig`.replace(/\+/g, "-").replace(/\//g, "_");
}

describe("RegisterForm", () => {
  beforeEach(() => {
    useSession.getState().clear();
  });

  it("creates the user and auto-logs in when the login step succeeds", async () => {
    const token = makeFakeJwt({ sub: "new@nexus.test", uid: 99, role: "USER", exp: Math.floor(Date.now() / 1000) + 3600 });

    server.use(
      http.post("/api/v1/users", () =>
        HttpResponse.json({ success: true, message: "User created", error: null, data: { id: 99, email: "new@nexus.test" } }),
      ),
      http.post("/api/auth/login", () =>
        HttpResponse.json({ success: true, message: "ok", error: null, data: { token } }),
      ),
    );

    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/^Name/i), "New User");
    await userEvent.type(screen.getByLabelText(/Email/i), "new@nexus.test");
    await userEvent.type(screen.getByLabelText(/Phone/i), "555-0100");
    await userEvent.type(screen.getByLabelText(/^Password/i), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => expect(useSession.getState().accessToken).toBe(token));
  });

  it("surfaces the 409 duplicate-email message inline", async () => {
    server.use(
      http.post("/api/v1/users", () =>
        // Mirrors Spring's ApiResponse.error(ex.getMessage(), "Duplicate resource!"):
        // the specific reason is in `error`, `message` is only the category label.
        HttpResponse.json(
          { success: false, message: "Duplicate resource!", error: "User with email 'dupe@nexus.test' already exists!", data: null },
          { status: 409 },
        ),
      ),
    );

    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/^Name/i), "Dupe");
    await userEvent.type(screen.getByLabelText(/Email/i), "dupe@nexus.test");
    await userEvent.type(screen.getByLabelText(/Phone/i), "555-0101");
    await userEvent.type(screen.getByLabelText(/^Password/i), "correct-horse");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument());
  });

  it("enforces the 8-char password minimum before hitting the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<RegisterForm />);
    await userEvent.type(screen.getByLabelText(/^Name/i), "Shorty");
    await userEvent.type(screen.getByLabelText(/Email/i), "short@nexus.test");
    await userEvent.type(screen.getByLabelText(/Phone/i), "555");
    await userEvent.type(screen.getByLabelText(/^Password/i), "abc");
    await userEvent.click(screen.getByRole("button", { name: /sign up/i }));

    await waitFor(() => expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
