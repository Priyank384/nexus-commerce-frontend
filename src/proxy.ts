import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed the middleware convention to "proxy"; the file must export a
// function with that name (or a default). It always runs on the Node.js runtime.
// Mirrors SESSION_COOKIE in src/app/api/auth/_shared.ts. Duplicated rather than
// imported because this file must stay dependency-free.
const SESSION_COOKIE = "has_session";

// Signed-in areas. A visitor with no session hint cannot have a session, so send
// them to login before the client gate renders a spinner and bounces them a moment
// later. Authorization itself is enforced by Spring; this is navigation UX.
//
// It must be the hint cookie, not the refresh token: `rc` is scoped to /api/auth,
// so the browser never sends it on a /account or /cart request and every signed-in
// visitor would be redirected to /login.
const PROTECTED = /^\/(?:account|cart|checkout|orders|admin)(?:\/|$)/;

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (!PROTECTED.test(pathname)) return NextResponse.next();
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/account/:path*", "/cart/:path*", "/checkout/:path*", "/orders/:path*", "/admin/:path*"],
};
