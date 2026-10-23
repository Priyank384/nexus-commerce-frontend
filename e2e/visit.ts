import type { Page } from "@playwright/test";

/**
 * `next dev` compiles a route on its first request and these pages pull photographs from a CDN,
 * so Playwright's default `load` wait makes the cold navigation the slowest part of every spec.
 * The assertions are all about the DOM, and the streamed Suspense chunks are inline scripts that
 * have already run by `domcontentloaded`.
 *
 * The header marks its post-hydration render, so wait for that too: clicking a streamed button
 * before React attaches silently does nothing, which is the flake this prevents.
 */
export async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.locator("header[data-hydrated='true']").waitFor({ state: "attached", timeout: 30_000 });
}
