"use client";

import { useEffect, useState } from "react";

/**
 * The login limiter is a fixed window per IP shared by login and password-recovery requests, so
 * the honest message is a countdown rather than a retry button that will only be refused again.
 */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export function RateLimitCountdown({
  seconds,
  onExpire,
}: {
  seconds: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0) onExpire();
  }, [remaining, onExpire]);

  return (
    <p className="text-sm text-amber-600 mb-3">
      Too many attempts — retry in <span className="tabular-nums font-medium">{remaining}s</span>
    </p>
  );
}
