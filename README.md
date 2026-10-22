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

## Architecture — Backend-for-Frontend (BFF)

The browser never talks to Spring directly. Every API call is same-origin to this Next app
and one of:

1. **`/api/auth/{login,refresh,logout}`** — Next route handlers that set/clear an httpOnly
   refresh-token cookie (`rc`, `Path=/api/auth`) and forward credentials to Spring. Access
   tokens live in a memory-only Zustand store — never in `localStorage`.
2. **`/api/v1/[...path]`** — a generic proxy that forwards bearer, body, and query string to
   Spring's REST API.

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

No backend secrets live here. The Spring `.env` (`JWT_SECRET`, MySQL creds, New Relic key)
stays in the backend workspace.

## Layout

```
src/
├── app/
│   ├── (public)/       /, /products — browse without auth
│   ├── (auth)/         /login, /register
│   ├── (user)/         /cart, /orders — requires bearer
│   ├── (admin)/        /admin — requires ROLE_ADMIN
│   ├── api/
│   │   ├── auth/       login / refresh / logout route handlers (cookie BFF)
│   │   └── v1/         generic /api/v1/[...path] proxy
│   ├── layout.tsx      providers + header + footer
│   └── providers.tsx   QueryClientProvider + sonner Toaster
├── components/
│   ├── ui/             shadcn primitives
│   ├── site-header.tsx client header (session-aware, calls /api/auth/refresh on mount)
│   └── site-footer.tsx server footer (brand block + Shop/Account columns)
├── lib/
│   ├── api/            backend.ts, client.ts (typed openapi-fetch + 401 retry), schema.d.ts
│   └── auth/           jwt.ts (decode only), session.ts (Zustand memory store)
└── test/               setup.ts + mocks/handlers.ts + mocks/server.ts (MSW)
e2e/                    Playwright specs
playwright.config.ts    baseURL http://localhost:3000, spawns `npm run dev`
vitest.config.ts        jsdom env, MSW server bootstraps in setup.ts
next.config.ts          /uploads/:path* rewrite so product images resolve via the BFF
```

## Route groups

Route groups are placeholders in Phase 0 — features land in Phases 1–6:

- **`(public)`** — no auth required.
- **`(auth)`** — signed-out entry points (login, register).
- **`(user)`** — layout redirects to `/login` when the session is empty.
- **`(admin)`** — layout additionally checks `user.role === "ADMIN"`.

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
- E2E: bring up the backend on `:3001`, then `npm run test:e2e`. Playwright spawns `next dev`
  automatically and reuses it if already running.

## Deploy

Deferred to Phase 7. Vercel is the planned target.
