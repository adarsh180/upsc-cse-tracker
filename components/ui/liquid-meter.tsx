import type { CSSProperties, ReactNode } from "react";

/**
 * Completion meter: a smooth progress ring with a glowing head, and a liquid
 * fill inside that rises to the completion level and ripples gently.
 * Pure SVG + CSS (see .lm-* in app/nova-study.css); safe in server components.
 */
export function LiquidMeter({
  pct,
  id,
  children,
  label,
}: {
  pct: number;
  id: string;
  children?: ReactNode;
  label?: string;
}) {
  const p = Math.max(0, Math.min(100, pct));
  // Inner liquid circle: centre 60, radius 44 → spans y 16..104.
  const level = 104 - 0.88 * p - 6;
  const clip = `lm-clip-${id}`;
  const grad = `lm-grad-${id}`;
  const wave = "M-60 6 Q-45 0 -30 6 T0 6 T30 6 T60 6 T90 6 T120 6 T150 6 T180 6 V140 H-60 Z";

  return (
    <div
      className={`lm${p >= 100 ? " is-full" : ""}${p === 0 ? " is-empty" : ""}`}
      style={{ "--p": p, "--lvl": `${level}px`, "--turn": `${p * 3.6}deg` } as CSSProperties}
      role="img"
      aria-label={label ?? `${p}% complete`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <circle cx="60" cy="60" r="44" />
          </clipPath>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--acc)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--acc)" />
          </linearGradient>
        </defs>

        <circle className="lm-bowl" cx="60" cy="60" r="44" />
        <g clipPath={`url(#${clip})`}>
          <g className="lm-level">
            <path className="lm-wave lm-wave-back" d={wave} />
            <path className="lm-wave lm-wave-front" d={wave} />
          </g>
        </g>

        <circle className="lm-track" cx="60" cy="60" r="53" />
        <circle
          className="lm-ring"
          cx="60"
          cy="60"
          r="53"
          pathLength={100}
          stroke={`url(#${grad})`}
          transform="rotate(-90 60 60)"
        />
        {p > 0 && p < 100 ? (
          <g className="lm-head">
            <circle className="lm-head-halo" cx="60" cy="7" r="7" />
            <circle className="lm-head-dot" cx="60" cy="7" r="3.6" />
          </g>
        ) : null}
      </svg>
      <div className="lm-core">{children}</div>
    </div>
  );
}
