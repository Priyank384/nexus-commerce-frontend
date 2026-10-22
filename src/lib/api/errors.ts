// Shared shape for the Spring `ApiResponse` envelope used everywhere.
// Kept permissive because some errors come back as HTML (proxied 502s) or
// without the envelope (framework rejections).
export type ApiEnvelope<T = unknown> = {
  success: boolean;
  message: string;
  error: string | null;
  data: T | null;
};

export type AuthFailure = {
  status: number;
  kind: "invalid_credentials" | "rate_limited" | "validation" | "unauthorized" | "server" | "network" | "unknown";
  message: string;
};

// Convert a fetch Response + parsed body into a typed AuthFailure the UI can
// branch on. Only call this for responses that aren't ok().
export function toAuthFailure(status: number, body: unknown): AuthFailure {
  const envelope = body as Partial<ApiEnvelope> | null;
  const message =
    (envelope && typeof envelope.message === "string" && envelope.message) ||
    (envelope && typeof envelope.error === "string" && envelope.error) ||
    `Request failed (${status})`;

  if (status === 401) {
    if (envelope?.error === "Invalid email or password!") {
      return { status, kind: "invalid_credentials", message: "Invalid email or password" };
    }
    return { status, kind: "unauthorized", message };
  }
  if (status === 429) return { status, kind: "rate_limited", message: "Too many attempts. Please wait a minute." };
  if (status === 400) return { status, kind: "validation", message };
  if (status >= 500) return { status, kind: "server", message };
  return { status, kind: "unknown", message };
}
