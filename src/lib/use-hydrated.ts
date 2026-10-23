import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const hydrated = () => true;
const server = () => false;

/**
 * False during SSR and the hydration render, true once React owns the DOM. Use it to
 * keep controls inert until their handlers exist — a pre-hydration submit is a native
 * form submission, which for a password form means a GET with the password in the URL.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, hydrated, server);
}
