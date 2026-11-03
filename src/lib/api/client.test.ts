import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "kQ7mZ2xT9vB4cL6pR8sY1uW3eA5nJ0hD7gF2kM9qXbE";

/**
 * openapi-fetch resolves globalThis.fetch when the client is constructed, so the recorder has
 * to be installed before ./client is imported — the api instance is a module singleton.
 */
let seen: { path: string; method: string; guest: string | null }[] = [];

vi.stubGlobal(
  "fetch",
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    seen.push({
      path: new URL(request.url).pathname,
      method: request.method,
      guest: request.headers.get("X-Guest-Token"),
    });
    return Response.json(request.url.endsWith("/guest-session") ? { data: { guestToken: TOKEN } } : { data: {} });
  }),
);

const { api } = await import("./client");
const { useSession } = await import("@/lib/auth/session");

describe("api client guest session header", () => {
  beforeEach(() => {
    seen = [];
    window.localStorage.clear();
    // Hydrated with no bearer: the shopper is anonymous, which is the case under test.
    useSession.getState().set(null);
  });
  afterEach(() => window.localStorage.clear());

  it("opens a guest session before reading the cart", async () => {
    // GET /api/v1/cart answers 401 for a caller with neither a token nor a session, so the
    // anonymous bag is unreachable until something mints one.
    await api.GET("/api/v1/cart");
    expect(seen.map((call) => call.path)).toEqual(["/api/auth/guest-session", "/api/v1/cart"]);
    expect(seen[1].guest).toBe(TOKEN);
  });

  it("reuses the stored session instead of minting a second one", async () => {
    window.localStorage.setItem("nx.guest-token", TOKEN);
    await api.GET("/api/v1/cart");
    expect(seen).toHaveLength(1);
    expect(seen[0].guest).toBe(TOKEN);
  });

  it("attaches to a payment call too", async () => {
    window.localStorage.setItem("nx.guest-token", TOKEN);
    await api.POST("/api/v1/payments/razorpay/orders/{orderId}", { params: { path: { orderId: 5 } } });
    expect(seen[0].path).toBe("/api/v1/payments/razorpay/orders/5");
    expect(seen[0].guest).toBe(TOKEN);
  });

  it("never mints for catalogue browsing", async () => {
    await api.GET("/api/v1/products");
    expect(seen).toHaveLength(1);
    expect(seen[0].path).toBe("/api/v1/products");
    expect(seen[0].guest).toBeNull();
  });

  it("sends the bearer alongside the session, which is what lets a merge work", async () => {
    window.localStorage.setItem("nx.guest-token", TOKEN);
    useSession.getState().set(signedInJwt());
    await api.POST("/api/v1/cart/merge", {});
    expect(seen[0].path).toBe("/api/v1/cart/merge");
    expect(seen[0].guest).toBe(TOKEN);
  });
});

function signedInJwt(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload = { sub: "shopper@nexus.test", uid: 3, role: "USER", exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.sig`;
}
