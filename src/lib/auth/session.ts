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
