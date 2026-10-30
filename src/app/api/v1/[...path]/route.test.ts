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
    vi.fn(async (url: string | URL, init: RequestInit) => {
      captured.url = String(url);
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

  it("never forwards the refresh cookie or spoofable origin headers", async () => {
    upstream({ "content-type": "application/json" }, "{}");
    await GET(
      new NextRequest("http://localhost:3000/api/v1/cart", {
        headers: {
          cookie: "rc=secret-refresh-token",
          "x-forwarded-for": "1.2.3.4",
          "x-real-ip": "1.2.3.4",
          forwarded: "for=1.2.3.4",
        },
      }),
    );
    expect(captured.headers?.get("cookie")).toBeNull();
    expect(captured.headers?.get("x-forwarded-for")).toBeNull();
    expect(captured.headers?.get("x-real-ip")).toBeNull();
    expect(captured.headers?.get("forwarded")).toBeNull();
  });

  it("drops an upstream set-cookie instead of folding it into a corrupt header", async () => {
    upstream({ "set-cookie": "rc=a, rc=b", "content-type": "application/json" }, "{}");
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("keeps the login endpoints out of reach of the generic proxy", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(
      new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        body: '{"email":"a@b.c","password":"x"}',
      }),
    );
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a segment that would resolve outside /api/v1", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products%2F..%2Factuator"));
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared body before contacting the backend", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await POST(
      new NextRequest("http://localhost:3000/api/v1/products", {
        method: "POST",
        headers: { "content-length": String(11 * 1024 * 1024) },
        body: "{}",
      }),
    );
    expect(res.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers with a generic 502 envelope instead of leaking the failure cause", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED 10.0.0.5:3001");
      }),
    );
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { message: string; error: string | null };
    expect(body.message).toBe("Backend unreachable");
    expect(body.error).toBeNull();
  });

  it("marks authenticated responses no-store but leaves public reads cacheable", async () => {
    upstream({ "content-type": "application/json" }, "{}");
    const cart = await GET(new NextRequest("http://localhost:3000/api/v1/cart"));
    expect(cart.headers.get("cache-control")).toBe("no-store");
    const products = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(products.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
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
