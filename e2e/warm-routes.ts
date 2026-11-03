import { request, type APIRequestContext } from "@playwright/test";

/**
 * `next dev` compiles a route on its first request, and that cost lands in the middle of the
 * first spec that touches the page — usually on a navigation assertion, where it looks like the
 * app is broken. Warming the routes once before the suite runs turns those into normal renders.
 */
const ROUTES = [
  "/",
  "/products",
  "/products/organic-cotton-crew-tee",
  "/products?keyword=zzzzz",
  "/login",
  "/register",
  "/cart",
  "/checkout",
  "/orders",
  "/orders/1",
  "/returns",
  "/shipping",
  "/size-guide",
  "/contact",
];

/**
 * The specs only ever talk to Spring through the dev server, and `reuseExistingServer` reuses
 * whichever one already holds :3000 — including one booted against a deployed API. That run looks
 * like a broken feature: the endpoints under test simply are not there yet upstream.
 *
 * Asking for a reset link on an address in the reserved `.invalid` TLD cannot match an account, so
 * the backend answers without mailing anyone; a 404/405 means the server in front of us is older
 * than the surface the suite assumes. Anything else, including a 429 from the shared limiter,
 * proves the route exists.
 */
async function assertBackendSurface(ctx: APIRequestContext, base: string) {
  const res = await ctx
    .post("/api/auth/forgot-password", { data: { email: "surface-probe@e2e.invalid" } })
    .catch(() => null);
  if (!res) return;
  if (res.status() === 404 || res.status() === 405) {
    throw new Error(
      `The dev server on ${base} answered the surface probe with ${res.status()}, so it proxies ` +
        `an API older than these specs. Stop it and let the harness boot its own — that one pins ` +
        `API_BASE_URL to the local Spring app, while a ".env.local" pointing somewhere else wins ` +
        `for a server that was already running.`,
    );
  }
}

async function warmRoutes() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const ctx = await request.newContext({ baseURL: base });
  await assertBackendSurface(ctx, base);
  for (const route of ROUTES) await ctx.get(route).catch(() => undefined);
  await ctx.dispose();
}

export default warmRoutes;
