import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { server } from "@/test/mocks/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

/** The one answer the endpoint gives for every address, real or not. */
const ALWAYS = {
  success: true,
  message: "If that address has an account, a reset link is on its way.",
  error: null,
  data: null,
};

describe("ForgotPasswordForm", () => {
  it("confirms the email went without ever confirming the account exists", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/auth/forgot-password", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(ALWAYS);
      }),
    );

    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "shopper@nexus.test");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /check shopper@nexus.test/i })).toBeInTheDocument(),
    );
    expect(sent).toEqual({ email: "shopper@nexus.test" });
    // Nothing on this screen may distinguish a registered address from an unregistered one.
    expect(screen.getByText(/if that address has an account/i)).toBeInTheDocument();
    expect(screen.queryByText(/no account found/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send reset link/i })).not.toBeInTheDocument();
  });

  it("lets the shopper start over for a different address", async () => {
    server.use(http.post("/api/auth/forgot-password", () => HttpResponse.json(ALWAYS)));

    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "first@nexus.test");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await screen.findByRole("heading", { name: /check first@nexus.test/i });

    await userEvent.click(screen.getByRole("button", { name: /different address/i }));
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
  });

  it("counts down instead of retrying a limited request", async () => {
    server.use(
      http.post(
        "/api/auth/forgot-password",
        () =>
          HttpResponse.json(
            { success: false, message: "Too many requests", error: "Rate limit exceeded", data: null },
            { status: 429 },
          ),
      ),
    );

    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "shopper@nexus.test");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument());
    expect(screen.getByText(/retry in/i).textContent).toMatch(/\d+s/);
    // The form stays put: the address was not wrong, the request was too early.
    expect(screen.getByLabelText(/Email/i)).toHaveValue("shopper@nexus.test");
  });

  it("does not send a request for an address the browser knows is malformed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText(/Email/i), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
