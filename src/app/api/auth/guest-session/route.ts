import type { NextRequest } from "next/server";
import { buildPassthroughResponse, envelopeError, forwardJson, isCrossSite } from "../_shared";

/**
 * Mints the anonymous shopping credential. It goes through a BFF handler rather than the
 * generic /api/v1 proxy because `auth/` is sealed off from browser traffic — and unlike the
 * refresh token, what comes back here is meant to be readable by JavaScript: the guest token
 * is a browser-side credential, the only proof a guest cart and a guest order have.
 */
export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return envelopeError(403, "Cross-site request rejected");

  const { res, parsed } = await forwardJson(req, "/api/v1/auth/guest-session", {});
  if (!res.ok) return buildPassthroughResponse(res, parsed);

  const envelope = parsed as { data?: { guestToken?: string } };
  if (!envelope.data?.guestToken) {
    console.error(`[bff] guest-session: upstream returned an unexpected shape (${res.status})`);
    return envelopeError(502, "Could not open a shopping session");
  }
  return buildPassthroughResponse(res, parsed);
}
