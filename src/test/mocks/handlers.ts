import { http, HttpResponse } from "msw";

export const handlers = [
  // Placeholder so the setup's "onUnhandledRequest: error" surfaces any
  // API call a test forgot to stub. Phase 1+ replaces these with real
  // login/refresh/products handlers per test file.
  http.post("/api/auth/refresh", () => HttpResponse.json({ success: false }, { status: 401 })),
];
