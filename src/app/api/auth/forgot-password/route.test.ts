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
  return new NextRequest("http://localhost:3000/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/forgot-password", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the email upstream and repeats the answer that refuses to leak accounts", async () => {
    const calls = upstream(
      200,
      {
        success: true,
        message: "If that address has an account, a reset link is on its way.",
        error: null,
        data: null,
      },
    );
    const response = await POST(request({ email: "Shopper@Nexus.test" }));
    expect(response.status).toBe(200);
    expect(calls[0].url).toBe("http://backend.test/api/v1/auth/forgot-password");
    expect(calls[0].body).toEqual({ email: "Shopper@Nexus.test" });
    await expect(response.json()).resolves.toMatchObject({
      message: "If that address has an account, a reset link is on its way.",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps the shared login limit visible instead of swallowing it", async () => {
    upstream(429, { success: false, message: "Too Many Requests", error: "Rate limit exceeded" });
    const response = await POST(request({ email: "shopper@nexus.test" }));
    expect(response.status).toBe(429);
  });

  it("answers with the envelope when Spring itself is unreachable", async () => {
    // What this sweep hit for real: the connection dropped, and Next turned the thrown
    // handler into a bodiless 500 the form could only report as "Request failed (500)".
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("fetch failed");
    }));

    const response = await POST(request({ email: "shopper@nexus.test" }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "The store is unreachable right now. Please try again.",
    });
    vi.restoreAllMocks();
  });

  it("refuses to answer for a site that is not this one", async () => {
    // A login-CSRF shaped request needs no cookie to be worth blocking: this form is unauthenticated.
    const calls = upstream(200, { success: true });
    const response = await POST(
      request({ email: "shopper@nexus.test" }, { "sec-fetch-site": "cross-site" }),
    );
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("rejects an empty address before the backend sees a probe", async () => {
    const calls = upstream(200, { success: true });
    const response = await POST(request({}));
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});
