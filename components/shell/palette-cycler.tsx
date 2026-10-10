"use client";

import { useEffect } from "react";

import { shiftPalette } from "@/components/theme-shift";
import { daypartFor, paletteForNow } from "@/lib/daycycle";

/**
 * Applies the day-cycle palette (lib/daycycle.ts) and re-arms at every minute
 * boundary, so every tab and page shows the same one and navigation never
 * resets it. Colours cross-fade via registered custom properties (app/nova.css).
 */
export function PaletteCycler() {
  useEffect(() => {
    const root = document.documentElement;
    let timer = 0;

    const apply = () => {
      const now = Date.now();
      const part = daypartFor(new Date(now));
      const palette = paletteForNow(now);
      if (root.dataset.palette !== palette || root.dataset.daypart !== part) {
        // A soft cross-fade of the whole page, played once by the GPU.
        shiftPalette(() => {
          root.dataset.daypart = part;
          root.dataset.palette = palette;
        });
      }
      timer = window.setTimeout(apply, 60000 - (Date.now() % 60000) + 40);
    };

    apply();
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
