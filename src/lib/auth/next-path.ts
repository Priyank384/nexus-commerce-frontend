/**
 * Where a sign-in or sign-up sends the shopper afterwards. Shared because the rule is a
 * security one, not a style one: an open redirect would hand a signed-in session to any URL
 * a phishing link can put in the query string.
 */
export function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * The link between the two halves of sign-in. Losing `?next` here is how a shopper chasing a
 * locked page ends up on the home page and has to start again.
 */
export function nextHref(path: string, next: string): string {
  return next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;
}
