import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  REFRESH_COOKIE,
  SESSION_COOKIE,
  buildPassthroughResponse,
  cookieOptions,
  envelopeError,
  forwardJson,
  isCrossSite,
  sessionHintOptions,
} from "../_shared";

type ResetBody = { token?: string; password?: string };

/**
 * Finishes a password reset with the token from the emailed link.
 *
 * A successful reset revokes every refresh token the account holds — that is the point of
 * resetting a password after something has gone wrong — so the cookie pair this browser is
 * carrying is already dead even though the shopper still looks signed in. Clearing it here is
 * what makes the UI tell the truth about the next step, which is signing in again.
 */
export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return envelopeError(403, "Cross-site request rejected");

  const body = (await req.json().catch(() => ({}))) as ResetBody;
  if (!body.token || !body.password) {
    return NextResponse.json(
      { success: false, message: "token and password are required", error: "Bad Request", data: null },
      { status: 400 },
    );
  }

  const { res, parsed } = await forwardJson(req, "/api/v1/auth/reset-password", {
    token: body.token,
    password: body.password,
  });
  if (!res.ok) return buildPassthroughResponse(res, parsed);

  const response = buildPassthroughResponse(res, parsed);
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionHintOptions(), maxAge: 0 });
  return response;
}
