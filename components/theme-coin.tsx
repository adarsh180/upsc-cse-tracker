"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { originOf, shiftTheme } from "./theme-shift";

type ThemeName = "dark" | "light";

/**
 * Light/dark switch for the private dashboards (AI-ML vault, Saath): a glass
 * coin that matches the dashboard switch. Shares the site-wide preference, so
 * the choice follows you between every dashboard.
 */
export function ThemeCoin({ storageKey = "upsc-theme" }: { storageKey?: string }) {
  const [theme, setTheme] = useState<ThemeName>("dark");
  useEffect(() => {
    const t = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(t);
  }, []);
  const light = theme === "light";
  return (
    <button
      type="button"
      className={`theme-coin ${light ? "is-light" : ""}`}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
      onClick={(e) => {
        const next: ThemeName = light ? "dark" : "light";
        setTheme(next);
        try {
          localStorage.setItem(storageKey, next);
        } catch {}
        shiftTheme(() => {
          document.documentElement.dataset.theme = next;
          document.documentElement.style.colorScheme = next;
        }, originOf(e.currentTarget));
      }}
    >
      <span className="theme-coin-icon"><Sun size={17} className="sun" /><Moon size={17} className="moon" /></span>
    </button>
  );
}
