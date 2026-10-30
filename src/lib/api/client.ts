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

// A 401 retry has to re-send the body, but the dispatched Request's body is already
// consumed by the time onResponse runs, so onRequest keeps a reusable copy: `null` for a
// bodyless call, the body text for JSON, or a clone for anything else. Keyed by the
// request object fetch() was actually handed.
const replayable = new WeakMap<Request, string | Request | null>();

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const bearer = await ensureFreshBearer();
    if (bearer) request.headers.set("Authorization", `Bearer ${bearer}`);
    if (!request.body) {
      replayable.set(request, null);
      return request;
    }
    // JSON is the common case, and rebuilding it from its text keeps Content-Length
    // intact. Cloning would turn the body into a stream: chunked on the wire, and the
    // unread clone holds a second copy of every upload in memory.
    if ((request.headers.get("content-type") ?? "").startsWith("application/json")) {
      const body = await request.text();
      const rebuilt = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body,
      });
      replayable.set(rebuilt, body);
      return rebuilt;
    }
    try {
      replayable.set(request, request.clone());
    } catch {
      // A streaming body (large upload) cannot be cloned; such a call is not retried.
    }
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401) return;
    // A request that went out signed-out cannot be rescued by a refresh.
    if (!request.headers.get("Authorization")) return;
    const snapshot = replayable.get(request);
    replayable.delete(request);
    if (snapshot === undefined) return;
    const retry = await refreshSession();
    if (!retry) return;
    const headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${retry}`);
    return fetch(
      snapshot instanceof Request
        ? new Request(snapshot, { headers })
        : new Request(request.url, {
            method: request.method,
            headers,
            ...(snapshot === null ? {} : { body: snapshot }),
          }),
    );
  },
};

export const api = createClient<paths>({ baseUrl: BASE_URL });
api.use(authMiddleware);

export function signedOut() {
  useSession.getState().clear();
}
