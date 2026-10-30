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
} from "../_shared";

export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return envelopeError(403, "Cross-site request rejected");

  const refreshToken = await currentRefreshToken();
  const auth = req.headers.get("authorization") ?? undefined;
  if (!refreshToken) {
    // Nothing to revoke on the refresh side. A bearer may still be live though, so send
    // an empty refresh token: Spring blacklists the access token and treats "" as
    // "nothing to revoke" rather than the missing-value 400 that null would raise.
    if (auth) {
      const { res, parsed } = await forwardJson(
        req,
        "/api/v1/auth/logout",
        { refreshToken: "" },
        { Authorization: auth },
      );
      const response = buildPassthroughResponse(res, parsed);
      response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
      response.cookies.set(SESSION_COOKIE, "", { ...sessionHintOptions(), maxAge: 0 });
      return response;
    }
    const response = NextResponse.json(
      { success: true, message: "Signed out", error: null, data: null },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
    // A stale hint with no token behind it would keep the proxy waving the visitor through.
    response.cookies.set(SESSION_COOKIE, "", { ...sessionHintOptions(), maxAge: 0 });
    return response;
  }

  const { res, parsed } = await forwardJson(
    req,
    "/api/v1/auth/logout",
    { refreshToken },
    auth ? { Authorization: auth } : {},
  );

  const response = buildPassthroughResponse(res, parsed);
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionHintOptions(), maxAge: 0 });
  return response;
}
