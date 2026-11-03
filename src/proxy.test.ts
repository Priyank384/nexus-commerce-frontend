import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function run(path: string, cookies: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost:3000${path}`, {
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    },
  });
  return { req, res: proxy(req) };
}

describe("proxy", () => {
  it("lets the public catalogue through untouched", () => {
    const { res } = run("/products");
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("lets a visitor holding the session hint into the protected area", () => {
    const { res } = run("/account", { has_session: "1" });
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects an anonymous visitor to login with the destination", () => {
    const { res } = run("/orders/12?tab=items");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/orders/12?tab=items");
  });

  it("lets an anonymous visitor reach the bag and checkout", () => {
    // Guest checkout is a supported path: the bag is owned by the browser's guest session,
    // and gating these routes would put a login wall on the way to the till.
    for (const path of ["/cart", "/checkout", "/checkout?step=payment"]) {
      expect(run(path).res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("does not accept the path-scoped refresh cookie as proof of a session", () => {
    // The browser never sends `rc` outside /api/auth, so trusting it here would
    // bounce every signed-in visitor back to login on /account and /cart.
    const { res } = run("/account", { rc: "refresh-token" });
    expect(res.status).toBe(307);
  });
});