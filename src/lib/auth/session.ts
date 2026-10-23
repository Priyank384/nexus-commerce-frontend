import { create } from "zustand";
import { decodeJwt, isExpired, type JwtClaims } from "./jwt";

export type SessionUser = {
  id: number;
  email: string;
  role: "USER" | "ADMIN";
};

type SessionState = {
  accessToken: string | null;
  claims: JwtClaims | null;
  user: SessionUser | null;
  hydrated: boolean;
  set: (accessToken: string | null) => void;
  clear: () => void;
};

function deriveUser(claims: JwtClaims | null): SessionUser | null {
  if (!claims?.uid || !claims.sub || !claims.role) return null;
  return {
    id: claims.uid,
    email: claims.sub,
    role: claims.role === "ADMIN" ? "ADMIN" : "USER",
  };
}

/**
 * Access token lives in memory only. On page reload it's gone — the (auth) bootstrap
 * calls /api/auth/refresh once to rehydrate. Never persist this to localStorage or
 * sessionStorage; the refresh token is the httpOnly cookie and is enough.
 */
export const useSession = create<SessionState>((set) => ({
  accessToken: null,
  claims: null,
  user: null,
  hydrated: false,
  set: (accessToken) => {
    const claims = decodeJwt(accessToken);
    set({
      accessToken,
      claims,
      user: deriveUser(claims),
      hydrated: true,
    });
  },
  clear: () => set({ accessToken: null, claims: null, user: null, hydrated: true }),
}));

export function hasValidAccessToken(): boolean {
  const { accessToken } = useSession.getState();
  const claims = decodeJwt(accessToken);
  return !isExpired(claims);
}

/**
 * Refresh tokens are single-use, so every caller (header bootstrap, 401 retry, request
 * gating) must share one in-flight request. Two concurrent refreshes would race and one
 * would come back 401, wiping a session that was actually valid.
 */
let inFlightRefresh: Promise<string | null> | null = null;

export function refreshSession(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
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
      inFlightRefresh = null;
    }
  })();
  return inFlightRefresh;
}

/**
 * Resolves with the bearer for this page load, rehydrating from the httpOnly cookie the
 * first time. Requests fired before the header has mounted (a shopper clicking Add to bag
 * right after a reload) used to go out signed-out and 401; they now wait here instead.
 */
export function ensureSession(): Promise<string | null> {
  const { accessToken, hydrated } = useSession.getState();
  if (hydrated) return Promise.resolve(accessToken);
  return refreshSession();
}
