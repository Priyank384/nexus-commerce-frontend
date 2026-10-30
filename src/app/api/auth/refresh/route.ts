import { NextRequest, NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  buildPassthroughResponse,
  cookieOptions,
  currentRefreshToken,
  envelopeError,
  forwardJson,
  isCrossSite,
  sessionHintOptions,
  stripRefresh,
} from "../_shared";

type RefreshData = {
  token: string;
  tokenType: string;
  expiresAt: string;
  refreshToken: string;
  user: unknown;
};

export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return envelopeError(403, "Cross-site request rejected");

  const refreshToken = await currentRefreshToken();
  if (!refreshToken) {
    // "You are not signed in" is the normal answer for an anonymous page view, and the header
    // asks on every cold load. A 401 makes Chrome log a network error on every page of the
    // storefront, which trains everyone to ignore the console; the token being absent is the
    // signal callers already branch on. A cookie that exists but is stale still 401s below.
    return NextResponse.json(
      { success: true, message: "No session", error: null, data: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { res, parsed } = await forwardJson(req, "/api/v1/auth/refresh", { refreshToken });
  if (!res.ok || !parsed) {
    const response = buildPassthroughResponse(res, parsed);
    // Only a rejected token is dead. A 5xx or a proxy blip must not log everyone out
    // of the storefront; the browser keeps the cookie and retries on the next load.
    if (res.status === 401 || res.status === 403) {
      response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
      // Drop the proxy hint too, or navigation keeps sending the shopper to pages that
      // will render the signed-out state.
      response.cookies.set(SESSION_COOKIE, "", { ...sessionHintOptions(), maxAge: 0 });
    }
    return response;
  }

  const envelope = parsed as { data?: RefreshData } & Record<string, unknown>;
  const data = envelope.data;
  if (!data?.refreshToken || !data.token) {
    // See login: an unexpected shape must never leak the refresh token to the client.
    console.error(`[bff] refresh: upstream returned an unexpected shape (${res.status})`);
    return envelopeError(502, "Session refresh failed");
  }

  const response = NextResponse.json(
    { ...envelope, data: stripRefresh(data) },
    { status: res.status, headers: { "Cache-Control": "no-store" } },
  );
  // Rotate — backend already deleted the old key on consume, so writing the new one
  // replaces what's in the browser's cookie jar.
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions());
  response.cookies.set(SESSION_COOKIE, "1", sessionHintOptions());
  return response;
}
