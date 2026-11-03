import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildPassthroughResponse, envelopeError, forwardJson, isCrossSite } from "../_shared";

type ForgotBody = { email?: string };

/**
 * Starts a password reset. The upstream deliberately answers the same way whether or not the
 * address has an account, and this handler must not be the place where that stops being true:
 * a different status for a missing email, or a message of our own, would turn a login page into
 * a directory of who shops here.
 */
export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return envelopeError(403, "Cross-site request rejected");

  const body = (await req.json().catch(() => ({}))) as ForgotBody;
  if (!body.email) {
    return NextResponse.json(
      { success: false, message: "email is required", error: "Bad Request", data: null },
      { status: 400 },
    );
  }

  const { res, parsed } = await forwardJson(req, "/api/v1/auth/forgot-password", {
    email: body.email,
  });
  // 429 arrives as itself: the reset request shares the login limiter, so a shopper hammering
  // this form is the same shopper hammering the door.
  return buildPassthroughResponse(res, parsed);
}
