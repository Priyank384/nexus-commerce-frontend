import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.API_BASE_URL = "http://backend.test";

const { POST } = await import("./route");

type Call = { url: string; body: Record<string, unknown> };

function upstream(status: number, body: unknown, capture: Call[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      capture.push({ url: String(url), body: JSON.parse(init?.body ?? "{}") });
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return capture;
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/reset-password", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exchanges the token and signs the browser out of a session it can no longer renew", async () => {
    // The backend revokes every refresh token on a reset, so a cookie left behind would keep the
    // proxy waving the shopper into /account on the strength of a token that no longer exists.
    const calls = upstream(200, { success: true, message: "Password reset", error: null, data: null });
    const response = await POST(request({ token: "opaque-token", password: "new-password" }));
    expect(response.status).toBe(200);
    expect(calls[0].body).toEqual({ token: "opaque-token", password: "new-password" });
    expect(response.cookies.get("rc")?.value).toBe("");
    expect(response.cookies.get("rc")?.maxAge).toBe(0);
    expect(response.cookies.get("has_session")?.value).toBe("");
  });

  it("leaves the session alone when the link is rejected", async () => {
    const calls = upstream(400, {
      success: false,
      message: "Bad Request!",
      error: "This reset link is invalid, has expired, or has already been used.",
    });
    const response = await POST(request({ token: "spent", password: "new-password" }));
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(1);
    await expect(response.json()).resolves.toMatchObject({
      error: "This reset link is invalid, has expired, or has already been used.",
    });
    expect(response.cookies.get("rc")).toBeUndefined();
    expect(response.cookies.get("has_session")).toBeUndefined();
  });

  it("refuses an incomplete body without spending a request on it", async () => {
    const calls = upstream(200, { success: true });
    const missingToken = await POST(request({ password: "new-password" }));
    const missingPassword = await POST(request({ token: "opaque-token" }));
    expect(missingToken.status).toBe(400);
    expect(missingPassword.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("refuses to answer for a site that is not this one", async () => {
    const calls = upstream(200, { success: true });
    const response = await POST(
      request(
        { token: "opaque-token", password: "new-password" },
        { "sec-fetch-site": "cross-site" },
      ),
    );
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});
