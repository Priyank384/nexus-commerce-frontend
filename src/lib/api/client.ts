import createClient, { type Middleware } from "openapi-fetch";
import { useSession } from "@/lib/auth/session";
import { decodeJwt, isExpired } from "@/lib/auth/jwt";
import type { paths } from "./schema";

// All browser traffic goes through the BFF proxy at /api/v1/[...path].
// The base URL is same-origin so Next route handlers see it and forward.
const BASE_URL = "/";

// One refresh at a time — concurrent 401s share the same refresh promise.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) {
        useSession.getState().clear();
        return null;
      }
      const body = (await res.json()) as { data?: { token?: string } };
      const token = body?.data?.token ?? null;
      useSession.getState().set(token);
      return token;
    } catch {
      useSession.getState().clear();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function currentBearer(): string | null {
  return useSession.getState().accessToken;
}

// Proactive-refresh: if the access token is > 30 s from expiry when we send, refresh
// before hitting the network. Catches the "user sat on a page then submitted" case
// without a 401 round-trip. The middleware's onResponse path still retries on 401.
async function ensureFreshBearer(): Promise<string | null> {
  const token = currentBearer();
  if (!token) return null;
  const claims = decodeJwt(token);
  if (isExpired(claims)) return refreshAccessToken();
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
    const retry = await refreshAccessToken();
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
