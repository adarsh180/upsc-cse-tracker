import type { CSSProperties, ReactNode } from "react";
import { Chakra } from "@/components/ui/chakra";

// Wave surfaces sit on a mean line at y = 6 in the liquid's own coordinates.
const MEAN = 6;

// Seamless wave: repeats every `period` units, so shifting it by one period
// loops without a seam. Wide enough to cover the bowl through that shift.
function wavePath(period: number, amp: number, closed: boolean) {
  const start = -2 * period;
  let d = `M${start} ${MEAN} Q${start + period / 4} ${MEAN - 2 * amp} ${start + period / 2} ${MEAN}`;
  for (let x = start + period; x <= 120 + 2 * period; x += period / 2) d += ` T${x} ${MEAN}`;
  return closed ? `${d} V240 H${start} Z` : d;
}

const WAVE_BACK = wavePath(60, 3, true);
const WAVE_MID = wavePath(40, 2, true);
const WAVE_FRONT = wavePath(60, 3, true);
const CREST_FRONT = wavePath(60, 3, false);

// A few bubbles, deterministic so server and client render the same markup.
const BUBBLES = [
  { x: 44, r: 1.3, dur: 5.2, delay: 2.4 },
  { x: 71, r: 0.9, dur: 4.1, delay: 3.6 },
  { x: 57, r: 1.6, dur: 6.4, delay: 4.9 },
  { x: 81, r: 1.1, dur: 5.6, delay: 6.8 },
  { x: 36, r: 0.8, dur: 4.6, delay: 8.1 },
];

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
  // A sliver of progress still reads as liquid, never an invisible line.
  const vp = p > 0 ? Math.max(p, 6) : 0;
  // Inner liquid circle: centre 60, radius 44 → spans y 16..104.
  const level = 104 - 0.88 * vp - MEAN;
  const clip = `lm-clip-${id}`;
  const grad = `lm-grad-${id}`;
  const depth = `lm-depth-${id}`;
  const glass = `lm-glass-${id}`;
  const running = p > 0 && p < 100;

  return (
    <div
      className={`lm${p >= 100 ? " is-full" : ""}${p === 0 ? " is-empty" : ""}`}
      style={
        {
          "--p": p,
          "--lvl": `${level}px`,
          "--deep": `${0.88 * vp}px`,
          "--turn": `${p * 3.6}deg`,
        } as CSSProperties
      }
      role="img"
      aria-label={label ?? `${p}% complete`}
    >
      <Chakra className="lm-halo" size={360} />
      {p > 0 ? (
        <span className="lm-lit" aria-hidden="true">
          <Chakra className="lm-halo" size={360} />
        </span>
      ) : null}
      <svg className="lm-gauge" viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <circle cx="60" cy="60" r="44" />
          </clipPath>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop className="lm-g0" offset="0%" />
            <stop className="lm-g1" offset="100%" />
          </linearGradient>
          {/* In the liquid's own space: bright at the surface, deeper below. */}
          <linearGradient id={depth} gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="104">
            <stop className="lm-d0" offset="0%" />
            <stop className="lm-d1" offset="14%" />
            <stop className="lm-d2" offset="100%" />
          </linearGradient>
          <radialGradient id={glass} cx="50%" cy="46%" r="54%">
            <stop className="lm-v0" offset="0%" />
            <stop className="lm-v1" offset="72%" />
            <stop className="lm-v2" offset="100%" />
          </radialGradient>
        </defs>

        <circle className="lm-bowl" cx="60" cy="60" r="44" fill={`url(#${glass})`} />
        {p === 0 ? <ellipse className="lm-dregs" cx="60" cy="101.5" rx="15" ry="1.1" /> : null}

        <g clipPath={`url(#${clip})`}>
          <g className="lm-slosh">
            <g className="lm-level">
              <g className="lm-swell lm-swell-back">
                <path className="lm-wave lm-wave-back" d={WAVE_BACK} />
              </g>
              <g className="lm-swell lm-swell-mid">
                <path className="lm-wave lm-wave-mid" d={WAVE_MID} />
              </g>
              <g className="lm-swell lm-swell-front">
                <g className="lm-flow-front">
                  <path className="lm-wave lm-wave-front" d={WAVE_FRONT} fill={`url(#${depth})`} />
                  <path className="lm-crest" d={CREST_FRONT} />
                </g>
              </g>
              {vp >= 14
                ? BUBBLES.map((b) => (
                    <circle
                      key={b.x}
                      className="lm-bubble"
                      cx={b.x}
                      cy="8"
                      r={b.r}
                      style={{ animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` } as CSSProperties}
                    />
                  ))
                : null}
            </g>
          </g>
        </g>

        {/* Glass: a soft reflection on the upper-left of the vessel. */}
        <path className="lm-glint" d="M24.3 47 A38 38 0 0 1 47 24.3" />
        <circle className="lm-glint-dot" cx="53.4" cy="22.6" r="1.1" />

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
        {running ? (
          <g className="lm-head">
            <circle className="lm-head-halo" cx="60" cy="7" r="7" />
            <circle className="lm-head-dot" cx="60" cy="7" r="3.6" />
          </g>
        ) : null}
        {p >= 100 ? (
          <>
            <circle className="lm-ripple" cx="60" cy="60" r="53" />
            <circle className="lm-ripple lm-ripple-2" cx="60" cy="60" r="53" />
          </>
        ) : null}
      </svg>
      <div className="lm-core">{children}</div>
    </div>
  );
}
