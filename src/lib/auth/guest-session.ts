const STORAGE_KEY = "nx.guest-token";

/** Mirrors ShopperIdentity.HEADER and the [A-Za-z0-9_-]{43} the backend validates. */
export const GUEST_HEADER = "X-Guest-Token";
const MINTED = /^[A-Za-z0-9_-]{43}$/;

/**
 * The credential an anonymous browser shops with. Unlike the session tokens it is meant to be
 * readable by JavaScript and to survive a reload: it is the only proof a guest cart, a guest
 * payment and a guest order have, so losing one mid-checkout loses the shopper their bag.
 *
 * A value that does not match what the backend mints is dropped rather than sent, because
 * Spring refuses a malformed header with 401 on every cart call — a corrupted entry would
 * otherwise wedge the session with no way for the shopper to recover it.
 */
function readStored(): string | null {
  if (typeof window === "undefined") return null;
  let value: string | null;
  try {
    value = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage disabled (private mode) — the session simply is not persisted
  }
  if (value === null) return null;
  if (!MINTED.test(value)) {
    clearGuestToken();
    return null;
  }
  return value;
}

export function getGuestToken(): string | null {
  return readStored();
}

export function clearGuestToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

// Two cart calls fired on the same tick (add-to-bag plus a badge refresh) must not mint two
// sessions; the second token would strand the first one's lines. Same single-flight shape as
// refreshSession in session.ts.
let inFlight: Promise<string | null> | null = null;

/** The session token, minted through the BFF the first time the shopper touches the cart. */
export function ensureGuestToken(): Promise<string | null> {
  const existing = readStored();
  if (existing) return Promise.resolve(existing);
  if (typeof window === "undefined") return Promise.resolve(null);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch("/api/auth/guest-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { guestToken?: string } };
      const token = body?.data?.guestToken ?? null;
      if (!token || !MINTED.test(token)) return null;
      try {
        window.localStorage.setItem(STORAGE_KEY, token);
      } catch {
        // Storage full or blocked: the session still works for this page load.
      }
      return token;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
