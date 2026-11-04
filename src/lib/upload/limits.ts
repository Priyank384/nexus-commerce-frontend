/**
 * Vercel rejects a request whose body exceeds roughly 4.5 MB with its own plain-text
 * `FUNCTION_PAYLOAD_TOO_LARGE` 413 before any function code runs — measured against the
 * live deployment: 4,400,000 bytes reached the backend and 4,499,000 did not. The proxy
 * never sees a body past this size in production, so a client guard set above it would
 * promise an upload the platform cannot deliver.
 */
export const PLATFORM_MAX_BODY_BYTES = 4.5 * 1024 * 1024;

/**
 * The proxy's own flood guard. It sits above the platform ceiling deliberately: when the
 * BFF runs locally or self-hosted nothing buffers the body first, so this is the cap that
 * actually fires there.
 */
export const PROXY_MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * The largest file that still fits inside a multipart request under the platform ceiling.
 * A multipart body is the file plus its boundary and headers — small, but not zero — so an
 * image exactly at the wall would fail with a 413 whose body isn't the JSON envelope the
 * client parses. The headroom keeps the failure on the client, where it is explainable.
 */
export function uploadSafeFileBytes(): number {
  return Math.floor(Math.min(PROXY_MAX_BODY_BYTES, PLATFORM_MAX_BODY_BYTES) * 0.9);
}
