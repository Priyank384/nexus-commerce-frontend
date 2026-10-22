import { NextRequest, NextResponse } from "next/server";
import { REFRESH_COOKIE, buildPassthroughResponse, cookieOptions, currentRefreshToken, forwardJson } from "../_shared";

export async function POST(req: NextRequest) {
  const refreshToken = await currentRefreshToken();
  const auth = req.headers.get("authorization") ?? undefined;
  if (!refreshToken) {
    // Nothing to revoke on the refresh side; still honour the access-token blacklist
    // by calling the backend, but treat missing cookie as an already-logged-out state.
    return NextResponse.json(
      { success: true, message: "Signed out", error: null, data: null },
      { status: 200 },
    );
  }

  const { res, parsed } = await forwardJson(
    req,
    "/api/v1/auth/logout",
    { refreshToken },
    auth ? { Authorization: auth } : {},
  );

  const response = buildPassthroughResponse(res, parsed);
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(req.nextUrl.protocol === "https:"), maxAge: 0 });
  return response;
}
