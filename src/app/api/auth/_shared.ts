import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/api/backend";

export const REFRESH_COOKIE = "rc";
// Aligned with backend JWT_REFRESH_EXPIRATION_DAYS (default 7). If the backend config
// changes, mirror it here.
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

export function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE,
  };
}

export function stripRefresh<T extends { refreshToken?: string }>(body: T): Omit<T, "refreshToken"> {
  const { refreshToken: _omit, ...rest } = body;
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
    headers: {
      "Content-Type": "application/json",
      Origin: backendUrl(),
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
  return NextResponse.json(parsed, { status: res.status });
}
