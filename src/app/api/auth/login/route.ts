import { NextRequest, NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  buildPassthroughResponse,
  cookieOptions,
  forwardJson,
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
    // Unexpected shape — surface backend response verbatim so the client can debug.
    return buildPassthroughResponse(res, parsed);
  }

  const response = NextResponse.json(
    { ...envelope, data: stripRefresh(data) },
    { status: res.status },
  );
  response.cookies.set(REFRESH_COOKIE, data.refreshToken, cookieOptions(req.nextUrl.protocol === "https:"));
  return response;
}
