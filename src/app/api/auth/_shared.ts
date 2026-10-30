import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/api/backend";

export const REFRESH_COOKIE = "rc";
/**
 * Presence-only companion to the refresh cookie. The refresh token itself is scoped to
 * /api/auth so it never travels to a page or an API route that might forward it; the proxy,
 * however, runs on /account, /cart and friends and would never see a path-scoped cookie.
 * This flag is what it reads — it carries no secret, only "a refresh token exists".
 */
export const SESSION_COOKIE = "has_session";
// Aligned with backend JWT_REFRESH_EXPIRATION_DAYS (default 7). If the backend config
// changes, mirror it here.
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Secure comes from the app's own environment, never from the request. Deriving it
 * from `x-forwarded-proto` means a proxy that drops the header silently issues a
 * refresh cookie without the Secure flag in production.
 */
export function cookieOptions(secure = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE,
  };
}

/** Same flags as the refresh cookie, but readable by the proxy on every route. */
export function sessionHintOptions(secure = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: REFRESH_MAX_AGE,
  };
}

/**
 * SameSite=Lax already blocks a cross-site POST from carrying the refresh cookie,
 * but a login CSRF (victim silently signed into the attacker's account) needs no
 * cookie at all. Reject anything a browser marks as cross-site, and any Origin
 * that is not this deployment.
 */
export function isCrossSite(req: NextRequest): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false; // non-browser client; no ambient cookie is at risk
  try {
    return new URL(origin).origin !== req.nextUrl.origin;
  } catch {
    return true;
  }
}

export function envelopeError(status: number, message: string): NextResponse {
  return NextResponse.json(
    { success: false, message, error: null, data: null },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function stripRefresh<T extends { refreshToken?: string }>(body: T): Omit<T, "refreshToken"> {
  const { refreshToken, ...rest } = body;
  return rest;
}

export async function currentRefreshToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value ?? null;
}

export async function forwardJson(
  req: NextRequest,
  upstreamPath: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const res = await fetch(`${backendUrl()}${upstreamPath}`, {
    method: "POST",
    // No Origin header: this is a server-to-server call, and the backend's CORS
    // allowlist only names the storefront origin.
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  return { res, parsed };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function buildPassthroughResponse(res: Response, parsed: unknown) {
  return NextResponse.json(parsed, { status: res.status, headers: { "Cache-Control": "no-store" } });
}
