import type { CSSProperties, ReactNode } from "react";

/**
 * Lightweight, dependency-free app marks. These are not official trademark
 * assets; they are compact brand-inspired tiles that keep the UI recognizable
 * without shipping external image files.
 */

export type ScreenApp = {
  key: string;
  label: string;
  shortLabel: string;
  group: "Social" | "Video" | "Utility";
  color: string;
  solid: string;
  glyph: ReactNode;
};

const g = (children: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const SCREEN_APPS: ScreenApp[] = [
  {
    key: "instagram",
    label: "Instagram",
    shortLabel: "IG",
    group: "Social",
    color: "linear-gradient(135deg, #feda75, #d62976 45%, #962fbf 80%, #4f5bd5)",
    solid: "#d62976",
    glyph: g(
      <>
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.7" />
        <circle cx="17" cy="7" r="0.75" fill="currentColor" stroke="currentColor" />
      </>,
    ),
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    shortLabel: "WA",
    group: "Social",
    color: "linear-gradient(135deg, #25d366, #128c7e)",
    solid: "#25d366",
    glyph: g(
      <>
        <path d="M5.1 19.2l1.2-3.5A7.4 7.4 0 1 1 9 18.3l-3.9.9z" />
        <path d="M9.3 8.8c.4 3 2.3 4.9 5.3 5.5" />
        <path d="M9.2 8.8l.8 1.5-.7 1.1M14.6 14.3l-1.5-.8-1 .8" />
      </>,
    ),
  },
  {
    key: "youtube",
    label: "YouTube",
    shortLabel: "YT",
    group: "Video",
    color: "linear-gradient(135deg, #ff4e45, #cc0000)",
    solid: "#ff0000",
    glyph: g(
      <>
        <rect x="3" y="6.5" width="18" height="11" rx="3.4" fill="rgba(255,255,255,0.06)" />
        <path d="M10.8 9.4l4.4 2.6-4.4 2.6z" fill="currentColor" stroke="currentColor" />
      </>,
    ),
  },
  {
    key: "youtubeStudy",
    label: "YouTube (study)",
    shortLabel: "Study",
    group: "Video",
    color: "linear-gradient(135deg, #3ec77a, #1f9d57)",
    solid: "#1f9d57",
    glyph: g(
      <>
        <rect x="3" y="6.5" width="18" height="11" rx="3.4" />
        <path d="M10.8 9.4l4.4 2.6-4.4 2.6z" fill="currentColor" stroke="currentColor" />
        <path d="M6.8 19h10.4" />
      </>,
    ),
  },
  {
    key: "facebook",
    label: "Facebook",
    shortLabel: "FB",
    group: "Social",
    color: "linear-gradient(135deg, #3b82f6, #1877f2)",
    solid: "#1877f2",
    glyph: <span className="app-letter-mark app-letter-facebook">f</span>,
  },
  {
    key: "netflix",
    label: "Netflix",
    shortLabel: "NFLX",
    group: "Video",
    color: "linear-gradient(135deg, #e50914, #b00610)",
    solid: "#e50914",
    glyph: <span className="app-letter-mark app-letter-netflix">N</span>,
  },
  {
    key: "hotstar",
    label: "Disney+ Hotstar",
    shortLabel: "Hotstar",
    group: "Video",
    color: "linear-gradient(135deg, #1f80e0, #0b2a6b)",
    solid: "#1f80e0",
    glyph: g(
      <>
        <path d="M5 9.8c3-3.8 9-4.8 14-1.9" />
        <path d="M12 7.6l1.3 3.1 3.4.3-2.6 2.2.8 3.3-2.9-1.8-2.9 1.8.8-3.3L7.3 11l3.4-.3z" />
      </>,
    ),
  },
  {
    key: "mxPlayer",
    label: "MX Player",
    shortLabel: "MX",
    group: "Video",
    color: "linear-gradient(135deg, #2aa8ff, #1f6feb)",
    solid: "#2aa8ff",
    glyph: g(
      <>
        <circle cx="12" cy="12" r="8.4" />
        <path d="M10 8.8l5.2 3.2L10 15.2z" fill="currentColor" stroke="currentColor" />
      </>,
    ),
  },
  {
    key: "google",
    label: "Google / browsing",
    shortLabel: "Google",
    group: "Utility",
    color: "linear-gradient(135deg, #4285f4, #34a853 55%, #fbbc05 80%, #ea4335)",
    solid: "#4285f4",
    glyph: (
      <span className="google-mark" aria-hidden="true">
        <i>G</i>
      </span>
    ),
  },
  {
    key: "other",
    label: "Other",
    shortLabel: "Other",
    group: "Utility",
    color: "linear-gradient(135deg, #8a93a6, #5b6477)",
    solid: "#8a93a6",
    glyph: g(
      <>
        <circle cx="7" cy="7" r="1.3" fill="currentColor" />
        <circle cx="12" cy="7" r="1.3" fill="currentColor" />
        <circle cx="17" cy="7" r="1.3" fill="currentColor" />
        <circle cx="7" cy="12" r="1.3" fill="currentColor" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" />
        <circle cx="17" cy="12" r="1.3" fill="currentColor" />
        <circle cx="7" cy="17" r="1.3" fill="currentColor" />
        <circle cx="12" cy="17" r="1.3" fill="currentColor" />
        <circle cx="17" cy="17" r="1.3" fill="currentColor" />
      </>,
    ),
  },
];

export const DISTRACTION_KEYS = SCREEN_APPS.map((a) => a.key).filter((k) => k !== "youtubeStudy");

export function AppTile({ app, size = 36 }: { app: ScreenApp; size?: number }) {
  return (
    <span
      className={`app-tile app-tile-${app.key}`}
      style={{ "--app-bg": app.color, width: size, height: size } as CSSProperties}
      aria-hidden="true"
    >
      {app.glyph}
    </span>
  );
}
