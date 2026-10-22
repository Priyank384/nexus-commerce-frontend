import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "./route";

// The route builds the upstream URL from this at call time.
process.env.API_BASE_URL = "http://backend.test";

type Probe = { init?: RequestInit; headers?: Headers; url?: string };

const captured: Probe = {};

function upstream(headers: Record<string, string>, body: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.init = init;
      captured.headers = new Headers(init.headers);
      return new Response(body, { status: 200, headers });
    }),
  );
}

describe("/api/v1 proxy", () => {
  beforeEach(() => {
    captured.url = undefined;
    captured.headers = undefined;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("drops the gzip claim from a body it already decoded", async () => {
    // Spring compresses anything over 2 KB; Node fetch gunzips it transparently,
    // so the header would describe bytes the browser never sees.
    upstream({ "content-encoding": "gzip", "content-type": "application/json" }, '{"data":[]}');
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/categories/tree"));
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(res.headers.get("content-type")).toContain("application/json");
    await expect(res.json()).resolves.toEqual({ data: [] });
    expect(captured.url).toBe("http://backend.test/api/v1/categories/tree");
  });

  it("keeps query strings and forwards the bearer", async () => {
    upstream({ "content-type": "application/json" }, "{}");
    await GET(
      new NextRequest("http://localhost:3000/api/v1/products?category=mens-denim&page=2", {
        headers: { authorization: "Bearer abc" },
      }),
    );
    expect(captured.url).toBe("http://backend.test/api/v1/products?category=mens-denim&page=2");
    expect(captured.headers?.get("authorization")).toBe("Bearer abc");
    expect(captured.headers?.get("host")).toBeNull();
  });

  it("answers with a 502 envelope instead of throwing when upstream is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { message: string; error: string };
    expect(body.message).toBe("Backend unreachable");
    expect(body.error).toContain("ECONNREFUSED");
  });

  it("streams the request body for writes", async () => {
    upstream({ "content-type": "application/json" }, "{}");
    await POST(
      new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        body: '{"variantId":1}',
      }),
    );
    expect(captured.init?.method).toBe("POST");
    expect(captured.init?.body).toBeTruthy();
  });

  it("exposes DELETE so soft-deletes reach the backend", async () => {
    expect(DELETE).toBe(GET);
    upstream({ "content-type": "application/json" }, "{}");
    const res = await DELETE(
      new NextRequest("http://localhost:3000/api/v1/wishlist/3", { method: "DELETE" }),
    );
    expect(captured.init?.method).toBe("DELETE");
    expect(res.status).toBe(200);
  });
});
