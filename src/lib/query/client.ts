import type { QueryClient } from "@tanstack/react-query";

let client: QueryClient | null = null;

/** Called once by <Providers>; gives non-React code (auth refresh, sign-out) a handle. */
export function registerQueryClient(next: QueryClient) {
  client = next;
}

/**
 * Drops every cached query. The API client is authenticated, so once the identity
 * behind it changes, anything still in memory belongs to the previous account —
 * carts, orders, addresses and admin metrics must not survive a sign-out or an
 * account switch.
 */
export function clearQueryCache() {
  if (!client) return;
  // Cancel first: a fetch that resolves after clear() would otherwise repopulate
  // the cache it was just evicted from.
  void client.cancelQueries();
  client.clear();
}
