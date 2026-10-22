/**
 * Server-only accessor for the backend base URL.
 * Imported by route handlers (BFF) and RSC; NEVER import from client components.
 */
export function backendUrl(): string {
  const raw = process.env.API_BASE_URL;
  if (!raw) {
    throw new Error("API_BASE_URL is not set (see .env.local)");
  }
  return raw.replace(/\/+$/, "");
}
