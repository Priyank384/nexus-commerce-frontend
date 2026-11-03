import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.API_BASE_URL = "http://backend.test";

const { POST } = await import("./route");

const TOKEN = "kQ7mZ2xT9vB4cL6pR8sY1uW3eA5nJ0hD7gF2kM9qXbE";

function request(init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest("http://localhost:3000/api/auth/guest-session", { method: "POST", ...init });
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

describe("POST /api/auth/guest-session", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("hands the minted credential back to the browser", async () => {
    const calls = upstream(200, { success: true, message: "Guest session opened", error: null, data: { guestToken: TOKEN } });
    const res = await POST(request());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ data: { guestToken: TOKEN } });
    expect(calls).toEqual(["http://backend.test/api/v1/auth/guest-session"]);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("passes a backend refusal through with its own status", async () => {
    upstream(503, { success: false, message: "Service Unavailable", error: null, data: null });
    const res = await POST(request());
    expect(res.status).toBe(503);
  });

  it("refuses to invent a session when the upstream body has no token", async () => {
    // An empty credential would make every cart call go out unauthenticated and 401, which
    // looks to the shopper like a broken store rather than a broken mint.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    upstream(200, { success: true, message: "ok", error: null, data: {} });
    const res = await POST(request());
    expect(res.status).toBe(502);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("rejects a cross-site mint", async () => {
    const calls = upstream(200, { data: { guestToken: TOKEN } });
    const res = await POST(
      request({ headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });
});
