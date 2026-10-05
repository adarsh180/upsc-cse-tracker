"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

/**
 * A thin liquid bar at the very top of the viewport while a route loads.
 * It starts on any same-origin link click that changes the path, creeps
 * towards 90%, and completes when the new pathname commits. Colour comes from
 * the rotating accent, so it follows the theme and the minute palette.
 */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const first = useRef(true);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setState((current) => (current === "loading" ? "done" : current));
  }, [pathname, search]);

  useEffect(() => {
    if (state !== "done") return;
    const timer = window.setTimeout(() => setState("idle"), 520);
    return () => window.clearTimeout(timer);
  }, [state]);

  return <div className={`su-progress is-${state}`} aria-hidden="true"><span /></div>;
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
