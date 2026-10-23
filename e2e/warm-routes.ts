import { request } from "@playwright/test";

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
];

async function warmRoutes() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const ctx = await request.newContext({ baseURL: base });
  for (const route of ROUTES) await ctx.get(route).catch(() => undefined);
  await ctx.dispose();
}

export default warmRoutes;
