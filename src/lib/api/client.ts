import createClient, { type Middleware } from "openapi-fetch";
import { ensureSession, refreshSession, useSession } from "@/lib/auth/session";
import { decodeJwt, isExpired } from "@/lib/auth/jwt";
import type { paths } from "./schema";

// All browser traffic goes through the BFF proxy at /api/v1/[...path].
// The base URL is same-origin so Next route handlers see it and forward.
const BASE_URL = "/";

// Proactive-refresh: if the access token is > 30 s from expiry when we send, refresh
// before hitting the network. Catches the "user sat on a page then submitted" case
// without a 401 round-trip. A cold load has no token yet, so ensureSession() waits for
// the cookie rehydration first — otherwise an early click goes out signed-out.
async function ensureFreshBearer(): Promise<string | null> {
  const token = await ensureSession();
  if (!token) return null;
  if (isExpired(decodeJwt(token))) return refreshSession();
  return token;
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const bearer = await ensureFreshBearer();
    if (bearer) request.headers.set("Authorization", `Bearer ${bearer}`);
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401) return;
    // A request that went out signed-out cannot be rescued by a refresh.
    if (!request.headers.get("Authorization")) return;
    const retry = await refreshSession();
    if (!retry) return;
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${retry}`);
    return fetch(new Request(request, { headers }));
  },
};

export const api = createClient<paths>({ baseUrl: BASE_URL });
api.use(authMiddleware);

export function signedOut() {
  useSession.getState().clear();
}
