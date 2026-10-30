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
    const { res } = run("/checkout?step=payment");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/checkout?step=payment");
  });

  it("does not accept the path-scoped refresh cookie as proof of a session", () => {
    // The browser never sends `rc` outside /api/auth, so trusting it here would
    // bounce every signed-in visitor back to login on /account and /cart.
    const { res } = run("/account", { rc: "refresh-token" });
    expect(res.status).toBe(307);
  });
});