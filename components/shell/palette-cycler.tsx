"use client";

import { useEffect } from "react";

/**
 * Rotates the accent palette once a minute. The palette is derived from the
 * wall clock (minute number), so every tab and every page shows the same one
 * and navigation never "resets" it. Colours cross-fade via registered custom
 * properties in app/nova.css; the pre-paint script in layout.tsx sets the
 * first palette before hydration so there is no flash.
 */
export const PALETTES = ["brass", "saffron", "lotus", "banyan", "monsoon", "terracotta"] as const;

export function paletteForNow(now = Date.now()) {
  return PALETTES[Math.floor(now / 60000) % PALETTES.length];
}

export function PaletteCycler() {
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;

    const apply = () => {
      root.dataset.palette = paletteForNow();
      // Re-arm at the next minute boundary so tabs stay in lockstep.
      timer = window.setTimeout(apply, 60000 - (Date.now() % 60000) + 40);
    };

    apply();
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
