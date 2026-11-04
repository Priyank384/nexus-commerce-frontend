import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "./route";

// The route builds the upstream URL from this at call time.
process.env.API_BASE_URL = "http://backend.test";

const { revalidateTagMock } = vi.hoisted(() => ({ revalidateTagMock: vi.fn() }));

// The catalogue write path calls next/cache's revalidateTag, which needs a live
// cache context — record the calls instead and assert on them.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: revalidateTagMock,
}));

type Probe = { init?: RequestInit; headers?: Headers; url?: string; bodyBytes?: number };

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

/**
 * Real undici drains init.body and surfaces a body-stream error by rejecting the
 * fetch; the cap and its 413 only become observable if the fake fetch consumes the
 * body the same way.
 */
function upstreamReadingBody() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init: RequestInit) => {
      captured.url = String(url);
      captured.init = init;
      captured.headers = new Headers(init.headers);
      const body = init.body as ReadableStream<Uint8Array> | null;
      if (body) {
        const reader = body.getReader();
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
        }
        captured.bodyBytes = total;
      }
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }),
  );
}

// 11 MiB in 1 MiB chunks — past MAX_BODY_BYTES (10 MiB) with no declared length,
// which is exactly the shape of a chunked upload.
function bodyPastCap(): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ >= 11) controller.close();
      else controller.enqueue(new Uint8Array(1024 * 1024));
    },
  });
}

describe("/api/v1 proxy", () => {
  beforeEach(() => {
    captured.url = undefined;
    captured.headers = undefined;
    revalidateTagMock.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

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

  it("kills a chunked body that streams past the cap without declaring a length", async () => {
    upstreamReadingBody();
    const req = new NextRequest("http://localhost:3000/api/v1/products", {
      method: "POST",
      body: bodyPastCap(),
    });
    expect(req.headers.get("content-length")).toBeNull();
    const res = await POST(req);
    // The body reached the upstream hop — only the stream capper could stop it —
    // and a mid-stream cap is the caller's fault, so it must not masquerade as a 502.
    expect(captured.url).toBe("http://backend.test/api/v1/products");
    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({
      success: false,
      message: "Request body too large",
      error: null,
      data: null,
    });
  });

  it("passes a normal-sized streamed body through the capper intact", async () => {
    upstreamReadingBody();
    const res = await POST(
      new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        body: '{"variantId":1}',
      }),
    );
    expect(res.status).toBe(200);
    expect(captured.url).toBe("http://backend.test/api/v1/cart/items");
    expect(captured.bodyBytes).toBe('{"variantId":1}'.length);
  });

  /**
   * A spun-down Render container is slow and a wedged one never answers; without a
   * deadline Vercel kills the function and the shopper gets a platform error instead
   * of this retryable 502. A rejection — the timeout's landing point — must answer
   * the envelope, not throw.
   */
  it("puts a deadline on the upstream fetch and turns its rejection into a 502 envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init: RequestInit) => {
        captured.url = String(url);
        captured.init = init;
        throw new Error("simulated wedged backend past the deadline");
      }),
    );
    const res = await GET(new NextRequest("http://localhost:3000/api/v1/products"));
    expect(captured.init?.signal).toBeInstanceOf(AbortSignal);
    expect(captured.init?.signal?.aborted).toBe(false);
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      success: false,
      message: "Backend unreachable",
      error: null,
      data: null,
    });
  });

  it("answers a clean 502 envelope instead of crashing on a missing API_BASE_URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("API_BASE_URL", "");
    const res = await POST(
      new NextRequest("http://localhost:3000/api/v1/products", {
        method: "POST",
        body: '{"name":"x"}',
      }),
    );
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      success: false,
      message: "Backend unreachable",
      error: null,
      data: null,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("expires the catalogue cache when an order moves stock", async () => {
    upstream({ "content-type": "application/json" }, "{}");
    const res = await POST(
      new NextRequest("http://localhost:3000/api/v1/orders", {
        method: "POST",
        body: '{"email":"a@b.c"}',
      }),
    );
    expect(res.status).toBe(200);
    expect(revalidateTagMock).toHaveBeenCalledWith("products", { expire: 0 });
  });

  it("leaves the cache alone for a cart add — it moves no stock", async () => {
    upstream({ "content-type": "application/json" }, "{}");
    await POST(
      new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        body: '{"variantId":1}',
      }),
    );
    expect(revalidateTagMock).not.toHaveBeenCalled();
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
    // Every upstream hop carries the deadline, including the ones that succeed.
    expect(captured.init?.signal).toBeDefined();
  });

  /**
   * Chrome sends `Origin` on a same-origin POST but not on a GET, so forwarding it made
   * Spring's CORS filter answer 403 "Invalid CORS request" to every write on the deployed
   * storefront while every page kept loading. This is the shape of the live bug, and a GET
   * assertion would not have caught it.
   */
  it("never carries the browser's Origin into the server-to-server call", async () => {
    upstream({ "content-type": "application/json" }, "{}");
    await POST(
      new NextRequest("http://localhost:3000/api/v1/cart/items", {
        method: "POST",
        body: '{"variantId":1}',
        headers: { origin: "https://nexus-commerce-frontend-ten.vercel.app", referer: "https://nexus-commerce-frontend-ten.vercel.app/products/1" },
      }),
    );
    expect(captured.headers?.get("origin")).toBeNull();
    expect(captured.headers?.get("referer")).toBeNull();
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
