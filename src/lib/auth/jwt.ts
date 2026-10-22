/**
 * Client-side JWT decode. We do NOT verify the signature — the backend already did that.
 * We only read claims to (a) know when the access token expires so we can proactively
 * refresh, and (b) gate UI on role. Any security decision still lives in Spring.
 */
export type JwtClaims = {
  sub?: string;
  uid?: number;
  role?: string;
  jti?: string;
  exp?: number;
  iat?: number;
};

function base64UrlDecode(input: string): string {
  const padLength = (4 - (input.length % 4)) % 4;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLength);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeJwt(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(base64UrlDecode(parts[1])) as JwtClaims;
  } catch {
    return null;
  }
}

export function isExpired(claims: JwtClaims | null, skewSeconds = 30): boolean {
  if (!claims?.exp) return true;
  // Treat the token as expired if it will expire within `skewSeconds` — that way we
  // refresh proactively instead of racing the request.
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
