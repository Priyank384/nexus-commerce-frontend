import { describe, expect, it } from "vitest";
import { PLATFORM_MAX_BODY_BYTES, PROXY_MAX_BODY_BYTES, uploadSafeFileBytes } from "./limits";

/**
 * Measured against the live Vercel deployment, not from docs: a 4,400,000-byte body reached
 * the backend and a 4,499,000-byte body was answered by the platform with a plain-text
 * FUNCTION_PAYLOAD_TOO_LARGE before any function code ran.
 */
const LARGEST_BODY_VERIFIED_TO_TRAVERSE_PRODUCTION = 4_400_000;

describe("upload limits", () => {
  it("keeps the advertised upload under the body proven to reach the backend in production", () => {
    expect(uploadSafeFileBytes()).toBeLessThanOrEqual(
      LARGEST_BODY_VERIFIED_TO_TRAVERSE_PRODUCTION,
    );
  });

  /**
   * The multipart envelope adds a boundary, part headers and a CRLF terminator around the
   * file, so a file sitting exactly on the limit would still push the request over it and
   * fail with the platform's unparseable 413.
   */
  it("leaves headroom for the multipart framing around the file", () => {
    expect(PLATFORM_MAX_BODY_BYTES - uploadSafeFileBytes()).toBeGreaterThan(100 * 1024);
  });

  it("derives the ceiling from the platform, not the proxy's own flood guard", () => {
    expect(uploadSafeFileBytes()).toBeLessThan(PROXY_MAX_BODY_BYTES);
    expect(uploadSafeFileBytes()).toBeLessThanOrEqual(PLATFORM_MAX_BODY_BYTES);
  });
});
