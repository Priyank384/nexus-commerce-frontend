import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearGuestToken, ensureGuestToken, getGuestToken, GUEST_HEADER } from "./guest-session";

const TOKEN = "kQ7mZ2xT9vB4cL6pR8sY1uW3eA5nJ0hD7gF2kM9qXbE";

function minting(body: unknown, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

describe("guest session", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("names the header the backend reads", () => {
    expect(GUEST_HEADER).toBe("X-Guest-Token");
  });

  it("mints a session once and reuses it", async () => {
    const calls = minting({ data: { guestToken: TOKEN } });
    await expect(ensureGuestToken()).resolves.toBe(TOKEN);
    await expect(ensureGuestToken()).resolves.toBe(TOKEN);
    expect(calls).toEqual(["/api/auth/guest-session"]);
    expect(getGuestToken()).toBe(TOKEN);
  });

  it("mints only once for concurrent callers", async () => {
    // An add-to-bag and a badge refresh on the same tick must not create two shopping sessions.
    const calls = minting({ data: { guestToken: TOKEN } });
    const [a, b] = await Promise.all([ensureGuestToken(), ensureGuestToken()]);
    expect(a).toBe(TOKEN);
    expect(b).toBe(TOKEN);
    expect(calls).toHaveLength(1);
  });

  it("drops a stored value the backend would refuse", () => {
    // Spring 401s a malformed header on every cart call, so a corrupted entry would otherwise
    // leave the shopper permanently locked out of their own bag.
    window.localStorage.setItem("nx.guest-token", "not-a-minted-token");
    expect(getGuestToken()).toBeNull();
    expect(window.localStorage.getItem("nx.guest-token")).toBeNull();
  });

  it("keeps nothing when the mint fails", async () => {
    minting({ success: false }, 500);
    await expect(ensureGuestToken()).resolves.toBeNull();
    expect(getGuestToken()).toBeNull();
  });

  it("ignores a token the upstream did not actually mint", async () => {
    minting({ data: { guestToken: "short" } });
    await expect(ensureGuestToken()).resolves.toBeNull();
    expect(window.localStorage.getItem("nx.guest-token")).toBeNull();
  });

  it("clears on request", async () => {
    minting({ data: { guestToken: TOKEN } });
    await ensureGuestToken();
    clearGuestToken();
    expect(getGuestToken()).toBeNull();
  });
});
