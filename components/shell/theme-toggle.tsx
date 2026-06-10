"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "upsc-theme";
type ThemeName = "dark" | "light";

function getPreferredTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(storageKey);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    const next = getPreferredTheme();
    setTheme(next);
    applyTheme(next);
  }, []);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      className={`v2-iconbtn theme-toggle ${className}`.trim()}
      onClick={() => {
        const next: ThemeName = isLight ? "dark" : "light";
        setTheme(next);
        window.localStorage.setItem(storageKey, next);
        applyTheme(next);
      }}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      {isLight ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
