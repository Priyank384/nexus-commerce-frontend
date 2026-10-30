"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const ORDER = ["light", "dark", "system"] as const;
type Mode = (typeof ORDER)[number];

// The canonical "are we on the client?" shim. A mount effect that flips state
// trips react-hooks/set-state-in-effect, and useTheme() returns undefined on the
// server either way.
const noSubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Cycles light → dark → system. The cycle has to read `theme` (the stored choice) rather than
 * `resolvedTheme`: under a dark OS preference "system" resolves to "dark", so cycling on the
 * resolved value always picked "system" again and the page never left dark mode.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    // Same footprint as the icon so the header row does not jump.
    return <span className="inline-block size-4 align-middle" aria-hidden />;
  }

  const current: Mode = ORDER.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      aria-label={`Theme: ${current}. Switch to ${next}.`}
      title={`Theme: ${current} — click for ${next}`}
      onClick={() => setTheme(next)}
      className={className}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}
