import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.API_BASE_URL = "http://backend.test";

const store = vi.hoisted(() => ({ rc: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "rc" && store.rc !== null ? { value: store.rc } : undefined),
  }),
}));

const { POST } = await import("./route");

function request() {
  return new NextRequest("http://localhost:3000/api/auth/refresh", { method: "POST" });
}

function upstream(status: number, body: unknown) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    store.rc = null;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("answers an anonymous bootstrap with 200 and no token", async () => {
    // The header asks on every cold page load. A 401 here makes Chrome log a network error on
    // every page of the storefront, so "nobody is signed in" is not modelled as a failure.
    const calls = upstream(401, { success: false });
    const res = await POST(request());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      message: "No session",
      error: null,
      data: null,
    });
    expect(calls).toEqual([]);
    expect(res.cookies.get("has_session")).toBeUndefined();
  });

  it("rotates the cookie and keeps the refresh token out of the body", async () => {
    store.rc = "old-token";
    upstream(200, {
      success: true,
      message: "ok",
      error: null,
      data: {
        token: "access",
        tokenType: "Bearer",
        expiresAt: "2026-10-23T10:00:00Z",
        refreshToken: "new-token",
        user: { id: 7 },
      },
    });
    const res = await POST(request());
    const body = await res.json();
    expect(body.data.token).toBe("access");
    expect(body.data.refreshToken).toBeUndefined();
    expect(res.cookies.get("rc")?.value).toBe("new-token");
    // The proxy only sees path-"/" cookies, so rotation has to refresh the hint too.
    expect(res.cookies.get("has_session")?.value).toBe("1");
  });

  it("clears the cookie when the backend rejects a token that does exist", async () => {
    store.rc = "stale-token";
    upstream(401, { success: false, message: "Unauthorized!", error: "Refresh token expired" });
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(res.cookies.get("rc")?.value).toBe("");
    expect(res.cookies.get("has_session")?.value).toBe("");
  });

  it("keeps the cookie when the backend is unavailable", async () => {
    // A 5xx or a cold-starting backend must not sign every shopper out.
    store.rc = "good-token";
    upstream(503, { success: false, message: "Service Unavailable" });
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(res.cookies.get("rc")).toBeUndefined();
    expect(res.cookies.get("has_session")).toBeUndefined();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("writes a locked-down cookie", async () => {
    store.rc = "old-token";
    upstream(200, {
      success: true,
      data: { token: "access", refreshToken: "new-token", user: { id: 7 } },
    });
    const res = await POST(request());
    const cookie = res.cookies.get("rc");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/api/auth");

    const hint = res.cookies.get("has_session");
    expect(hint?.httpOnly).toBe(true);
    expect(hint?.sameSite).toBe("lax");
    expect(hint?.path).toBe("/");
  });
});
