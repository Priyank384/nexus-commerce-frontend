# Nexus Commerce — storefront

Next.js 16 App Router frontend for the [NexusCommerce](../NexusCommerce) Spring Boot backend,
branded as **Nexus Commerce**: a minimalist neutral apparel shop in the Everlane / COS
register — warm paper, ink text, hairline edges, one typeface, no decorative colour.

## Design system

Every token lives in `src/app/globals.css`; primitives stay the stock shadcn ones so upgrades
stay painless.

| Token / utility | What it gives you |
|-----------------|-------------------|
| `--background`, `--foreground`, `--border`, `--muted*` | Warm neutral scale (oklch, near zero chroma). Garment photography is the only colour on the page. |
| `--primary` | Ink. Used for the one action that matters per view ("Add to bag", "Sign up"). |
| `--radius: 0.25rem` | Crisp, near-square controls rather than pill-shaped ones. |
| `label-caps` | The brand's micro-label voice: uppercase, 0.6875rem, `0.14em` tracking. Nav, section eyebrows, table headings. |
| `shell-x` | The single horizontal rhythm (`max-width: 90rem`, clamp padding) shared by header, page body and footer so edges always line up. |
| `--font-sans` | Set by `Geist({ variable: "--font-sans" })` in `layout.tsx`. The name is load-bearing — `@theme inline` maps Tailwind's `font-sans` onto it, so a different variable silently drops the brand typeface. |
| `--font-heading` | `Inter Tight`, same name coupling. `h1`–`h3` get it (plus `tracking-tight`, weight 500) from a base-layer rule, so headings never need a class. |
| Theme | `next-themes` with `attribute="class"`: the `.dark` token block in `globals.css` and every `dark:` variant key off `<html class="dark">`. `ThemeToggle` is a two-state light/dark switch; "system" is only the starting default, and the first click resolves the OS preference and commits to its opposite, so the switch always changes what is on screen. `<html>` needs `suppressHydrationWarning` because the script rewrites the class before hydration. |
| `EmptyState` | One voice for every "nothing here yet" surface — empty bag, wishlist, order history, a filter that matched nothing. |

## Stack

- **Next.js 16.4.2** (App Router, Turbopack, `cacheComponents`, `partialPrefetching`)
- **React 19.3** + **TypeScript 5**
- **Tailwind v4** + **shadcn/ui** primitives
- **TanStack Query v5** for server state
- **Zustand** for the client session store
- **React Hook Form** + **Zod** for forms
- **openapi-fetch** + **openapi-typescript** for a typed backend client
- **Vitest** + **Testing Library** + **MSW** for unit/integration tests
- **Playwright** for e2e

## What's built

- **Storefront** — home, category listing with faceted search, product detail (colour/size
  picker, gallery, reviews), bag drawer and `/cart`, wishlist, account hub (profile, addresses,
  wishlist), multi-step checkout with Razorpay test mode, and order history/detail.
- **Admin console** (`/admin`, `ROLE_ADMIN`) — dashboard (order pipeline, revenue, sold-out
  count); category tree with create/edit/delete and `moveToTopLevel`; products with a
  size×colour variant builder and a gallery (append, delete, reorder); orders with the
  `PENDING → SHIPPED → DELIVERED` queue and a guarded cancel; inventory search with an
  out-of-stock filter and per-variant stock adjustment; and a minimal user table with
  search and enable/disable.
- **Production plumbing** — the session and catalogue reads render on the server, a proxy
  bounces signed-out visitors before the client gate flashes, the BFF refuses oversized uploads,
  CSP and security headers ship from `next.config.ts`, and sitemap / robots / manifest /
  JSON-LD / error boundaries cover the crawler and failure surfaces.

## Architecture — Backend-for-Frontend (BFF)

The browser never talks to Spring directly. Every API call is same-origin to this Next app
and one of:

1. **`/api/auth/{login,refresh,logout}`** — Next route handlers that set/clear an httpOnly
   refresh-token cookie (`rc`, `Path=/api/auth`) and forward credentials to Spring. Access
   tokens live in a memory-only Zustand store — never in `localStorage`.
2. **`/api/v1/[...path]`** — a generic proxy that forwards bearer, body, and query string to
   Spring's REST API.

The proxy rewrites two response headers, because "pipe it through verbatim" is wrong here:
Node's `fetch` transparently gunzips the upstream body, while Spring compresses anything over
its 2 KB threshold. Forwarding `Content-Encoding: gzip` alongside an already-decoded body
makes the browser abort with `ERR_CONTENT_DECODING_FAILED` — and it only bites on the large
responses (category tree, a page of products with variants), which is why it stays hidden
until a page finally needs real data. `Content-Length` is stripped for the same reason.

Because the browser only ever sees this app's origin, **no CORS change on the backend is
needed** under this pattern.

On 401 the typed client calls `/api/auth/refresh` once (single-flight), re-issues the
original request with the new bearer, and only fails if refresh also fails. The retry re-sends
a rebuilt body: cloning the dispatched request turns JSON into a chunked stream, which loses
`Content-Length` and makes the body unreadable to tests and proxies, so JSON requests are
reconstructed from their text instead.

### Session and cached reads

Access tokens live only in memory; on a cold load the header calls `ensureSession()`, which
shares one `/api/auth/refresh` with any request that fires first, and the BFF re-issues the
bearer from the `rc` cookie. The cookie is cleared only when refresh answers 401/403 — a 5xx
from the backend or the proxy must not sign everyone out.

Catalogue pages are server components over `src/lib/catalog/server.ts`, which marks reads with
`"use cache"` plus `cacheTag("products")` / `cacheTag("categories")`. Any non-GET catalogue
call that succeeds through the BFF calls `revalidateTag(tag, { expire: 0 })`, so the next page
view sees the write immediately instead of serving one stale render. User-scoped traffic never
goes through that cache and is marked `no-store`.

### Guards

`src/proxy.ts` (Next 16's rename of middleware) matches `/account`, `/cart`, `/checkout`,
`/orders` and `/admin` and redirects to `/login?next=…` when the `has_session` hint cookie is
missing. The hint is presence-only — it carries no token — so this is navigation UX, not
authorization: Spring still validates every call, `UserGate` waits for the session, and
`AdminGate` checks `role === "ADMIN"` before the console renders.

### BFF hardening

The proxy caps request bodies at 10 MB (via `Content-Length`, before reading the stream),
strips hop-by-hop headers, never forwards `cookie`, `set-cookie` or client identity headers
(`x-forwarded-*`, `forwarded`, `x-real-ip`) upstream, and asks upstream for an identity body
so a compressed response cannot reach the browser already-decoded. Responses under `auth/`,
`cart`, `orders`, `users`, `addresses`, `wishlist`, `admin/` and `payments/` are forced
`no-store`; everything else defaults to `public, max-age=0, must-revalidate`.

### Security headers

`next.config.ts` serves a CSP on every route: same-origin by default, Razorpay's checkout
script/frame/connect origins, `'unsafe-inline'` for Next's bootstrap script and inline styles,
and `'unsafe-eval'` only in development. Also `nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, a restrictive `Permissions-Policy`,
HSTS in production only, and `poweredByHeader: false`. `NEXT_IMAGE_HOSTS` entries are validated
as bare hostnames — a scheme or wildcard would break the build or turn the optimizer into an
SSRF vector.

### SEO and failure surfaces

`src/lib/site.ts` resolves the canonical origin once (`NEXT_PUBLIC_SITE_URL` →
Vercel's `VERCEL_PROJECT_PRODUCTION_URL` → `http://localhost:3000`); metadata, canonicals,
Open Graph, `sitemap.ts`, `robots.ts`, `manifest.ts` and the product JSON-LD all read it.
Signed-in segments set `robots: { index: false }`, and `error.tsx`, `global-error.tsx` and
`not-found.tsx` give every failure a branded page instead of the framework default.

## Prereqs

- Node 20+
- Backend running on `http://localhost:3001` (see [../NexusCommerce/README.md](../NexusCommerce/README.md))

## Setup

```bash
cp .env.example .env.local
npm install                # uses .npmrc legacy-peer-deps=true
npm run dev                # http://localhost:3000
```

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | `next dev` (Turbopack) on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run codegen` | Regenerate `src/lib/api/schema.d.ts` from a running backend's `/v3/api-docs`. Requires Spring on `API_BASE_URL` (default `http://localhost:3001`). |
| `npm test` | Vitest once (jsdom + MSW) — components, route handlers, `proxy.ts` |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright via `scripts/e2e.mjs`, which reads the backend `.env` and pins `API_BASE_URL` |

## Env

| Var | Default | Notes |
|-----|---------|-------|
| `API_BASE_URL` | `http://localhost:3001` | Server-only; used by the BFF proxy and `/uploads` rewrite. Never prefixed `NEXT_PUBLIC_`. |
| `PORT` | `3000` | `next dev` / `next start` listen port. |
| `NEXT_IMAGE_HOSTS` | empty | Comma-separated extra hostnames for `next/image` — hostnames only, no scheme or wildcard (production: the Supabase Storage public host). Read at build time, so changing it needs a redeploy. |
| `NEXT_PUBLIC_SITE_URL` | Vercel production URL, else `http://localhost:3000` | Canonical origin for `<link rel="canonical">`, Open Graph URLs, `sitemap.ts`, `robots.ts` and JSON-LD. A bare origin (`https://nexuscommerce.example`); a trailing slash is trimmed. |

No backend secrets live here. The Spring `.env` (`JWT_SECRET`, MySQL creds, New Relic key)
stays in the backend workspace.

## Layout

```
src/
├── app/
│   ├── (public)/       /, /products, /products/[slug] — browse without auth
│   ├── (auth)/         /login, /register
│   ├── (user)/         /cart, /checkout, /account, /orders — requires bearer
│   ├── (admin)/        /admin, /admin/products, /admin/categories, /admin/orders,
│   │                   /admin/inventory, /admin/users — requires ROLE_ADMIN
│   ├── api/
│   │   ├── auth/       login / refresh / logout route handlers (cookie BFF)
│   │   └── v1/         generic /api/v1/[...path] proxy (size cap, header stripping, tags)
│   ├── layout.tsx      metadata, fonts, providers, header + footer
│   ├── providers.tsx   QueryClientProvider + ThemeProvider (next-themes) + sonner Toaster
│   ├── error.tsx       route error boundary (global-error.tsx catches the root layout)
│   ├── not-found.tsx   branded 404
│   └── robots.ts, sitemap.ts, manifest.ts
├── proxy.ts            signed-out redirect for /account, /cart, /checkout, /orders, /admin
├── components/
│   ├── ui/             shadcn primitives (only the ones still used)
│   ├── admin/          admin-gate.tsx (ROLE_ADMIN check) and product-editor.tsx
│   ├── seo/            product-json-ld.tsx
│   ├── site-header.tsx  client header: session-aware (calls /api/auth/refresh on mount) and
│   │                    renders the category mega-menu from GET /api/v1/categories/tree
│   ├── site-footer.tsx  server footer (brand block + Shop/Account columns)
│   ├── theme-toggle.tsx light/dark switch (system is the initial default)
│   └── empty-state.tsx  shared "nothing here yet" block for bag / wishlist / orders / filters
├── lib/
│   ├── api/            backend.ts, client.ts (typed openapi-fetch + 401 retry), schema.d.ts
│   ├── auth/           jwt.ts (decode only), session.ts (Zustand memory store)
│   ├── query/          client.ts — registered QueryClient, cleared when the identity changes
│   ├── catalog/        server.ts ("use cache" + product/category tags) and client queries
│   ├── site.ts         brand strings + canonical origin resolution
│   ├── admin/ orders/ cart/ wishlist/ reviews/ addresses/ checkout/ account/
│   └── …
└── test/               setup.ts + mocks/handlers.ts + mocks/server.ts (MSW)
e2e/                    Playwright specs
scripts/e2e.mjs         parses ../NexusCommerce/.env, pins API_BASE_URL, runs Playwright
playwright.config.ts    baseURL http://localhost:3000, spawns `npm run dev`
vitest.config.ts        jsdom env, MSW server bootstraps in setup.ts
next.config.ts          CSP + security headers, /uploads rewrite, validated image hosts
```

## Route groups

- **`(public)`** — no auth required. The header nav links categories by **slug**
  (`/products?category=mens-denim`), because names repeat across roots (Men/Denim and
  Women/Denim) and Spring resolves the filter with `findBySlugIgnoreCase`.
- **`(auth)`** — signed-out entry points (login, register).
- **`(user)`** — `UserGate` waits for the session and redirects to `/login` when it is empty;
  `proxy.ts` has usually redirected already, before any client bundle runs.
- **`(admin)`** — `AdminGate` checks `user.role === "ADMIN"` before the console renders. The
  shell renders the admin nav; each screen talks only to endpoints Spring already gates with
  `ROLE_ADMIN`.

Guards are UX only — the proxy reads a presence-only hint cookie and the gates read the decoded
token. Real authorization is enforced by Spring; the BFF forwards whatever bearer the client has
and lets 403/401 bubble up.

## Adding a new backend call

1. Ensure Spring is running and hit `npm run codegen` — `schema.d.ts` refreshes.
2. Use the typed client:
   ```ts
   const { data, error } = await api.GET("/api/v1/products/{id}", { params: { path: { id } } });
   ```
3. Bearer injection + 401-refresh-retry are automatic.

## Reading an error response

Spring's `ApiResponse` puts the specific reason in `error` and only a category label in
`message` — `{"message":"Forbidden!","error":"You can only access your own orders"}`. Go
through `toAuthFailure(status, body)` in `src/lib/api/errors.ts`; it prefers `error` and
maps the status to a `kind` the UI can branch on. Denials are **401** (missing, expired or
revoked bearer; bad credentials) and **403** (signed in but not the owner, or not
`ROLE_ADMIN`). Creates answer **201**, everything else including `DELETE` answers **200**
with the envelope — no endpoint returns 204.

## Testing

- Unit: `npm test` — MSW stubs the BFF (`/api/auth/*`) and any `/api/v1/*` paths a test hits.
- E2E: bring up the backend on `:3001`, then run the suite. `npm run test:e2e` reads
  `../NexusCommerce/.env` itself (`scripts/e2e.mjs`) for `ADMIN_BOOTSTRAP_EMAIL` / `_PASSWORD`
  and the Razorpay keys — do not `source` that file, unquoted `&`/`#` in a value breaks the shell.
  It also pins `API_BASE_URL=http://localhost:3001` (unless the shell already sets it), so a
  `.env.local` pointing the dev server at a deployed backend does not leak into the run. Because
  Playwright reuses a dev server that is already running, restart it after changing that value.

  ```bash
  npm run test:e2e
  ```

  The live Razorpay specs skip themselves when `RAZORPAY_*` keys are absent.

  Specs are written to be re-runnable: the admin flow creates uniquely-titled pieces and
  removes them through the API in `test.afterAll`, so a failed assertion does not seed the next
  run with stray catalogue rows. Playwright keeps screenshots and video only on failure and
  `forbidOnly` is on in CI, so a stray `test.only` cannot silently skip the suite.

## Deploy

Vercel, with the Spring backend on Render (see the backend repo's `DEPLOYMENT.md`).

1. Import this repository into Vercel (framework preset **Next.js**, branch `main`).
2. Set `API_BASE_URL` to the deployed API origin, `NEXT_IMAGE_HOSTS` to the Supabase Storage
   public hostname (no scheme), and `NEXT_PUBLIC_SITE_URL` to the canonical storefront origin
   so canonicals, Open Graph and the sitemap point at the real domain. Changing the image hosts
   needs a redeploy — remote patterns are resolved at build time.
3. Deploy. No backend secret lives in Vercel; the BFF cookie is httpOnly, `SameSite=Lax` and
   `Secure` on HTTPS, and never leaves this origin. Security headers — including HSTS — are
   emitted by `next.config.ts` and only take effect over HTTPS, which Vercel provides.
