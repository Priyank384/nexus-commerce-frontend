import { NextRequest, NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  buildPassthroughResponse,
  cookieOptions,
  currentRefreshToken,
  forwardJson,
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
  const refreshToken = await currentRefreshToken();
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, message: "No session", error: "Unauthorized", data: null },
      { status: 401 },
    );
  }

  const { res, parsed } = await forwardJson(req, "/api/v1/auth/refresh", { refreshToken });
  if (!res.ok || !parsed) {
    // Refresh failed (token consumed/expired/rotated). Clear the cookie so the
    // client stops attempting silent refresh and bounces to login.
    const response = buildPassthroughResponse(res, parsed);
    response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(req.nextUrl.protocol === "https:"), maxAge: 0 });
    return response;
  }

  const envelope = parsed as { data?: RefreshData } & Record<string, unknown>;
  const data = envelope.data;
  if (!data?.refreshToken || !data.token) {
    return buildPassthroughResponse(res, parsed);
  }

  const response = NextResponse.json(
    { ...envelope, data: stripRefresh(data) },
    { status: res.status },
  );
  // Rotate — backend already deleted the old key on consume, so writing the new one
  // replaces what's in the browser's cookie jar.
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions(req.nextUrl.protocol === "https:"));
  return response;
}
