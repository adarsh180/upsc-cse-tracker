import type { CSSProperties } from "react";

import { MOMENTUM_TIERS, tierForHours } from "@/components/goals/momentum-tiers";

const MAX = 14;
const CX = 120;
const CY = 124;
const R = 96;
const ARC = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`;

function point(hours: number, radius: number) {
  const angle = Math.PI - (Math.min(hours, MAX) / MAX) * Math.PI;
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

/**
 * Semicircular 0–14h gauge. A smooth arc fills to today's hours; a glowing
 * tip travels with the fill and a sheen runs along the filled part. The 8h
 * (good) and 12h (peak) bars are marked as pins outside the arc so nothing
 * crowds the readout.
 */
export function HoursDial({ hours, score }: { hours: number; score: number }) {
  const tier = MOMENTUM_TIERS[tierForHours(hours)];
  const pct = (Math.min(hours, MAX) / MAX) * 100;
  const tone = hours > 0 ? tier.accent : "var(--nv-faint)";
  const marks = [
    { h: 8, label: "8h", cls: "good" },
    { h: 12, label: "12h", cls: "peak" },
  ];

  return (
    <div
      className={`hd${hours > 0 ? " is-live" : ""}`}
      style={{ "--tier": tone, "--pct": pct, "--deg": `${pct * 1.8}deg` } as CSSProperties}
    >
      <svg viewBox="0 0 240 142" aria-hidden="true">
        <defs>
          <linearGradient id="hd-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
            <stop offset="100%" stopColor={tone} />
          </linearGradient>
        </defs>
        <path className="hd-track" d={ARC} pathLength={100} />
        <path className="hd-fill" d={ARC} pathLength={100} stroke="url(#hd-grad)" />
        {hours > 0 ? <path className="hd-sheen" d={ARC} pathLength={100} /> : null}

        {marks.map((m) => {
          const pin = point(m.h, R + 13);
          const text = point(m.h, R + 24);
          const side = text.x > CX + 30;
          return (
            <g key={m.h} className={`hd-mark ${m.cls}${hours >= m.h ? " is-hit" : ""}`}>
              <circle cx={pin.x} cy={pin.y} r="3" />
              <text x={side ? text.x + 2 : text.x} y={side ? text.y + 4 : text.y + 1} textAnchor={side ? "start" : "middle"}>
                {m.label}
              </text>
            </g>
          );
        })}

        {hours > 0 ? (
          <g className="hd-tip">
            <circle className="hd-tip-halo" cx={CX - R} cy={CY} r="11" />
            <circle className="hd-tip-dot" cx={CX - R} cy={CY} r="5.5" />
          </g>
        ) : null}
      </svg>

      <div className="hd-core">
        <strong>
          {hours ? (Number.isInteger(hours) ? hours : hours.toFixed(1)) : 0}
          <em>h</em>
        </strong>
        <span>{tier.label === "Rest" ? "Not logged yet" : `${tier.label} day`}</span>
        <small>
          Score <b>{score}</b>/100
        </small>
      </div>
      <div className="hd-ends" aria-hidden="true">
        <span>0</span>
        <span>14h</span>
      </div>
    </div>
  );
}
