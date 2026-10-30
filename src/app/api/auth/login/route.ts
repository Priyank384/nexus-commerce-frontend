import { NextRequest, NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  buildPassthroughResponse,
  cookieOptions,
  envelopeError,
  forwardJson,
  isCrossSite,
  sessionHintOptions,
  stripRefresh,
} from "../_shared";

type LoginBody = { email?: string; password?: string };

type LoginData = {
  token: string;
  tokenType: string;
  expiresAt: string;
  refreshToken: string;
  user: unknown;
};

export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return envelopeError(403, "Cross-site request rejected");

  const body = (await req.json().catch(() => ({}))) as LoginBody;
  if (!body.email || !body.password) {
    return NextResponse.json(
      { success: false, message: "email and password are required", error: "Bad Request", data: null },
      { status: 400 },
    );
  }

  const { res, parsed } = await forwardJson(req, "/api/v1/auth/login", body);
  if (!res.ok || !parsed) return buildPassthroughResponse(res, parsed);

  const envelope = parsed as { data?: LoginData } & Record<string, unknown>;
  const data = envelope.data;
  if (!data?.refreshToken || !data.token) {
    // Never echo an unexpected upstream body: that is exactly how the refresh
    // token would end up in JavaScript-readable JSON instead of the cookie.
    console.error(`[bff] login: upstream returned an unexpected shape (${res.status})`);
    return envelopeError(502, "Sign-in failed");
  }

  const response = NextResponse.json(
    { ...envelope, data: stripRefresh(data) },
    { status: res.status, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions());
  response.cookies.set(SESSION_COOKIE, "1", sessionHintOptions());
  return response;
}
