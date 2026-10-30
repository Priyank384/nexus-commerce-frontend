"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

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
 * A two-state light/dark switch. "system" is only the starting default: the first click has to
 * change what the shopper is looking at, so it resolves the OS preference and commits to the
 * opposite of it. Cycling the stored value instead made the first click go system → light,
 * which is a no-op whenever the OS is already light.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    // Same footprint as the icon so the header row does not jump.
    return <span className="inline-block size-4 align-middle" aria-hidden />;
  }

  const current = theme === "light" || theme === "dark"
    ? theme
    : resolvedTheme === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  const Icon = current === "dark" ? Moon : Sun;

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
