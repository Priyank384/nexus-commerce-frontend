# Plain Thread — storefront

Next.js 16 App Router frontend for the [NexusCommerce](../NexusCommerce) Spring Boot backend,
branded as **Plain Thread**: a minimalist neutral apparel shop in the Everlane / COS
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
| Theme | `next-themes` with `attribute="class"`: the `.dark` token block in `globals.css` and every `dark:` variant key off `<html class="dark">`. `ThemeToggle` cycles light → dark → system; `<html>` needs `suppressHydrationWarning` because the script rewrites the class before hydration. |
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
original request with the new bearer, and only fails if refresh also fails.

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
| `npm test` | Vitest once (jsdom + MSW) |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright against `next dev` and Spring on 3001 |

## Env

| Var | Default | Notes |
|-----|---------|-------|
| `API_BASE_URL` | `http://localhost:3001` | Server-only; used by the BFF proxy and `/uploads` rewrite. Never prefixed `NEXT_PUBLIC_`. |
| `PORT` | `3000` | `next dev` / `next start` listen port. |
| `NEXT_IMAGE_HOSTS` | empty | Comma-separated extra hostnames for `next/image` (production: the R2 public host). Read at build time. |

No backend secrets live here. The Spring `.env` (`JWT_SECRET`, MySQL creds, New Relic key)
stays in the backend workspace.

## Layout

```
src/
├── app/
│   ├── (public)/       /, /products — browse without auth
│   ├── (auth)/         /login, /register
│   ├── (user)/         /cart, /orders — requires bearer
├── (admin)/            /admin, /admin/products, /admin/categories, /admin/orders,
│                      /admin/inventory, /admin/users — requires ROLE_ADMIN
│   ├── api/
│   │   ├── auth/       login / refresh / logout route handlers (cookie BFF)
│   │   └── v1/         generic /api/v1/[...path] proxy
│   ├── layout.tsx      providers + header + footer
│   └── providers.tsx   QueryClientProvider + ThemeProvider (next-themes) + sonner Toaster
├── components/
│   ├── ui/             shadcn primitives
│   ├── site-header.tsx  client header: session-aware (calls /api/auth/refresh on mount) and
│   │                    renders the category mega-menu from GET /api/v1/categories/tree
│   ├── site-footer.tsx  server footer (brand block + Shop/Account columns)
│   ├── theme-toggle.tsx light → dark → system cycle
│   └── empty-state.tsx  shared "nothing here yet" block for bag / wishlist / orders / filters
├── lib/
│   ├── api/            backend.ts, client.ts (typed openapi-fetch + 401 retry), schema.d.ts
│   ├── auth/           jwt.ts (decode only), session.ts (Zustand memory store)
│   ├── admin/          typed queries/mutations for products, categories, orders, users
│   ├── catalog/        catalogue + product-detail queries and formatting
│   ├── orders/         order queries and shared status/payment/date formatting
│   └── …               cart, wishlist, reviews, addresses, checkout
└── test/               setup.ts + mocks/handlers.ts + mocks/server.ts (MSW)
e2e/                    Playwright specs
playwright.config.ts    baseURL http://localhost:3000, spawns `npm run dev`
vitest.config.ts        jsdom env, MSW server bootstraps in setup.ts
next.config.ts          /uploads/:path* rewrite so product images resolve via the BFF
```

## Route groups

- **`(public)`** — no auth required. The header nav links categories by **slug**
  (`/products?category=mens-denim`), because names repeat across roots (Men/Denim and
  Women/Denim) and Spring resolves the filter with `findBySlugIgnoreCase`.
- **`(auth)`** — signed-out entry points (login, register).
- **`(user)`** — layout redirects to `/login` when the session is empty.
- **`(admin)`** — layout additionally checks `user.role === "ADMIN"`. The shell renders the
  admin nav; each screen talks only to endpoints Spring already gates with `ROLE_ADMIN`.

Guards are client-side UX only. Real authorization is enforced by Spring; the BFF forwards
whatever bearer the client has and lets 403/401 bubble up.

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

## Deploy

Vercel, with the Spring backend on Render (see the backend repo's `DEPLOYMENT.md`).

1. Import this repository into Vercel (framework preset **Next.js**, branch `main`).
2. Set `API_BASE_URL` to the deployed API origin and `NEXT_IMAGE_HOSTS` to the R2 public
   hostname (no scheme). Changing the image hosts needs a redeploy — remote patterns are
   resolved at build time.
3. Deploy. No backend secret lives in Vercel; the BFF cookie is httpOnly, `SameSite=Lax`
   and `Secure` on HTTPS, and never leaves this origin.
