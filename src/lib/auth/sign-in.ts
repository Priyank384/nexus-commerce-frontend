import { useSession } from "./session";

/**
 * Signs the browser in with an address and password it already holds.
 *
 * Changing or resetting a password revokes every refresh token on the account — including the
 * one this browser is carrying — so the session that performed the change is dead the moment the
 * call succeeds. Re-signing is what stops a security action from logging a shopper out of their
 * own account; the caller passes the password it just proved was correct.
 */
export async function signInWith(email: string, password: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return false;
  }
  if (!res.ok) return false;

  const body = (await res.json().catch(() => null)) as { data?: { token?: string } } | null;
  const token = body?.data?.token;
  if (!token) return false;

  useSession.getState().set(token);
  return true;
}
