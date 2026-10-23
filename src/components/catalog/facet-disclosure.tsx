"use client";

import { useState, useSyncExternalStore } from "react";
import { SlidersHorizontal } from "lucide-react";

const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// The server renders as if wide so the facet links are in the HTML that Google and the
// first paint see; useSyncExternalStore swaps in the real breakpoint after hydration.
function getServerSnapshot() {
  return true;
}

/**
 * The filter column is a sidebar from `lg` up and a collapsible drawer below it. Reading the
 * breakpoint is a browser-only concern, so it goes through an external store rather than an
 * effect — a mount-time `setState` would cascade a render for every shopper on desktop.
 */
export function FacetDisclosure({ children }: { children: React.ReactNode }) {
  const wide = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? wide;

  return (
    <div>
      <button
        type="button"
        onClick={() => setToggled(!open)}
        aria-expanded={open}
        className="label-caps mb-5 flex w-full items-center justify-between border-y border-border py-3 text-left lg:hidden"
      >
        Refine
        <SlidersHorizontal aria-hidden className="size-4 text-muted-foreground" />
      </button>
      <div className={open ? undefined : "hidden lg:block"}>{children}</div>
    </div>
  );
}
