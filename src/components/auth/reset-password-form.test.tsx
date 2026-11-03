import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { server } from "@/test/mocks/server";

let query = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

const TOKEN = "kQ7mZ2xT9vB4cL6pR8sY1uW3eA5nJ0hD7gF2kM9qXbE";

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    query = `token=${TOKEN}`;
  });

  it("sends the token from the link with the password that was typed", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/auth/reset-password", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ success: true, message: "Password reset", error: null, data: null });
      }),
    );

    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^New password/i), "brand-new-password");
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "brand-new-password");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /new password set/i })).toBeInTheDocument(),
    );
    expect(sent).toEqual({ token: TOKEN, password: "brand-new-password" });
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("keeps a mistyped confirmation from costing the shopper their one link", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^New password/i), "brand-new-password");
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "brand-new-passworf");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  /**
   * A rejected token is spent or expired, not a typo — the password field is the one thing that
   * cannot be the problem, so the page has to stop offering it and point at a fresh link.
   */
  it("calls a rejected link dead instead of asking for the password again", async () => {
    server.use(
      http.post(
        "/api/auth/reset-password",
        () =>
          HttpResponse.json(
            {
              success: false,
              message: "Bad Request!",
              error: "This reset link is invalid, has expired, or has already been used.",
              data: null,
            },
            { status: 400 },
          ),
      ),
    );

    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^New password/i), "brand-new-password");
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "brand-new-password");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /send a new reset link/i })).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/invalid, has expired, or has already been used/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^New password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /send a new reset link/i })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("keeps the form when the store itself fails", async () => {
    server.use(
      http.post("/api/auth/reset-password", () =>
        HttpResponse.json(
          { success: false, message: "Internal Server Error", error: null, data: null },
          { status: 500 },
        ),
      ),
    );

    render(<ResetPasswordForm />);
    await userEvent.type(screen.getByLabelText(/^New password/i), "brand-new-password");
    await userEvent.type(screen.getByLabelText(/Confirm new password/i), "brand-new-password");
    await userEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() =>
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument(),
    );
    // The token is not what failed, so the form stays and the shopper can press the button again.
    expect(screen.getByLabelText(/^New password/i)).toBeInTheDocument();
  });

  it("refuses to submit a link that carries no token", async () => {
    query = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ResetPasswordForm />);

    expect(screen.getByRole("heading", { name: /this link will not work/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /send a new reset link/i })).toBeInTheDocument();
    // The panel mounts a Link, and Next's Link settles its own state a beat later; waiting
    // inside act keeps that update from landing outside this test's act scope.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
