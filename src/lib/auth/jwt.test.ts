import { describe, expect, it } from "vitest";
import { decodeJwt, isExpired } from "@/lib/auth/jwt";

// Minimal Phase 0 smoke test to prove the vitest + jsdom + MSW wiring runs.
// Real coverage lands with the auth/catalogue features in Phases 1–6.
describe("jwt helper", () => {
  it("decodes claims without verifying", () => {
    const header = btoa(JSON.stringify({ alg: "HS512", typ: "JWT" })).replace(/=+$/, "");
    const payload = btoa(
      JSON.stringify({ sub: "a@b.co", uid: 7, role: "ADMIN", exp: Math.floor(Date.now() / 1000) + 60 }),
    ).replace(/=+$/, "");
    // base64 (browser btoa) vs base64url — our decoder must handle both.
    const token = `${header}.${payload}.sig`.replace(/\+/g, "-").replace(/\//g, "_");
    const claims = decodeJwt(token);
    expect(claims?.sub).toBe("a@b.co");
    expect(claims?.uid).toBe(7);
    expect(claims?.role).toBe("ADMIN");
    expect(isExpired(claims)).toBe(false);
  });

  it("flags expired tokens", () => {
    const header = btoa(JSON.stringify({ alg: "HS256" })).replace(/=+$/, "");
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 10 })).replace(/=+$/, "");
    const token = `${header}.${payload}.s`;
    expect(isExpired(decodeJwt(token))).toBe(true);
  });

  it("returns null on non-JWT strings", () => {
    expect(decodeJwt(null)).toBeNull();
    expect(decodeJwt("not-a-jwt")).toBeNull();
  });
});
