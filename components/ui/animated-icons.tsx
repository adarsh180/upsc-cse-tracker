import type { CSSProperties } from "react";

export type MotionGlyphName =
  | "dashboard"
  | "goals"
  | "tests"
  | "analytics"
  | "mood"
  | "guru"
  | "rank"
  | "essay"
  | "study";

const glyphAccent: Record<MotionGlyphName, string> = {
  dashboard: "var(--gold-bright)",
  goals: "var(--rose-bright)",
  tests: "var(--physics)",
  analytics: "var(--lotus-bright)",
  mood: "var(--botany)",
  guru: "var(--gold-bright)",
  rank: "var(--botany)",
  essay: "var(--rose-bright)",
  study: "var(--physics)",
};

export function MotionGlyph({
  name,
  size = 46,
  label,
  className,
  style,
}: {
  name: MotionGlyphName;
  size?: number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const accent = glyphAccent[name];
  const title = label ?? name;

  return (
    <span
      className={["motion-glyph", `motion-glyph-${name}`, className].filter(Boolean).join(" ")}
      style={{ "--glyph-accent": accent, width: size, height: size, ...style } as CSSProperties}
      aria-label={title}
      role="img"
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id={`glyph-${name}-wash`} x1="8" x2="56" y1="8" y2="56">
            <stop stopColor="currentColor" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle className="motion-glyph-orbit" cx="32" cy="32" r="24" />
        <circle className="motion-glyph-orbit motion-glyph-orbit-b" cx="32" cy="32" r="17" />
        {name === "dashboard" ? (
          <>
            <path className="motion-glyph-line" d="M18 36h10V22H18v14Zm18 8h10V20H36v24ZM18 46h28" />
            <path className="motion-glyph-spark" d="M47 13l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" />
          </>
        ) : null}
        {name === "goals" ? (
          <>
            <circle className="motion-glyph-line" cx="32" cy="32" r="13" />
            <circle className="motion-glyph-fill" cx="32" cy="32" r="4" />
            <path className="motion-glyph-line" d="M32 14v8M32 42v8M14 32h8M42 32h8" />
          </>
        ) : null}
        {name === "tests" ? (
          <>
            <path className="motion-glyph-line" d="M22 18h20l5 6v23H22V18Z" />
            <path className="motion-glyph-line" d="M29 31h15M29 39h11" />
            <path className="motion-glyph-fill" d="M18 24l3 3 6-8" />
          </>
        ) : null}
        {name === "analytics" ? (
          <>
            <path className="motion-glyph-line" d="M16 44c7-18 13-5 20-18 4-8 8-9 12-5" />
            <path className="motion-glyph-line motion-glyph-dash" d="M17 49h32" />
            <circle className="motion-glyph-fill" cx="36" cy="26" r="3" />
          </>
        ) : null}
        {name === "mood" ? (
          <>
            <path className="motion-glyph-line" d="M20 34c0-9 5-15 12-15s12 6 12 15c0 8-5 14-12 14S20 42 20 34Z" />
            <path className="motion-glyph-line" d="M24 33c3-4 5-4 8 0s5 4 8 0" />
            <path className="motion-glyph-spark" d="M47 15l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8 1.8-4Z" />
          </>
        ) : null}
        {name === "guru" ? (
          <>
            <path className="motion-glyph-line" d="M20 34c0-9 5-16 12-16s12 7 12 16v8H20v-8Z" />
            <path className="motion-glyph-line" d="M26 34h12M32 18v-5" />
            <path className="motion-glyph-spark" d="M46 14l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" />
          </>
        ) : null}
        {name === "rank" ? (
          <>
            <path className="motion-glyph-line" d="M22 44V26h8v18M34 44V18h8v26M18 44h30" />
            <path className="motion-glyph-spark" d="M48 15l1.8 4 4 1.8-4 1.8-1.8 4-1.8-4-4-1.8 4-1.8 1.8-4Z" />
          </>
        ) : null}
        {name === "essay" ? (
          <>
            <path className="motion-glyph-line" d="M21 18h22v28H21V18Z" />
            <path className="motion-glyph-line" d="M27 27h11M27 35h9" />
            <path className="motion-glyph-fill" d="M41 39l6 6M44 36l6 6" />
          </>
        ) : null}
        {name === "study" ? (
          <>
            <path className="motion-glyph-line" d="M18 20c8-3 13-1 14 3v25c-2-4-7-6-14-3V20Z" />
            <path className="motion-glyph-line" d="M46 20c-8-3-13-1-14 3v25c2-4 7-6 14-3V20Z" />
            <path className="motion-glyph-spark" d="M32 14l1.6 3.6 3.8 1.4-3.8 1.4L32 24l-1.6-3.6-3.8-1.4 3.8-1.4L32 14Z" />
          </>
        ) : null}
      </svg>
    </span>
  );
}
