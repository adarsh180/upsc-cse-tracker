import type { CSSProperties } from "react";

import { MOMENTUM_TIERS, tierForHours } from "@/components/goals/momentum-tiers";

const MAX = 14;
const CX = 110;
const CY = 110;
const R = 88;

function point(hours: number, radius: number) {
  const angle = Math.PI - (Math.min(hours, MAX) / MAX) * Math.PI;
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

/** Semicircular 0–14h gauge with the 8h (good) and 12h (peak) bars marked. */
export function HoursDial({ hours, score }: { hours: number; score: number }) {
  const tier = MOMENTUM_TIERS[tierForHours(hours)];
  const pct = (Math.min(hours, MAX) / MAX) * 100;
  const tip = point(hours, R);

  return (
    <div className="hd" style={{ "--tier": hours > 0 ? tier.accent : "var(--nv-faint)", "--pct": pct } as CSSProperties}>
      <svg viewBox="0 0 220 128" aria-hidden="true">
        <path className="hd-track" d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`} pathLength={100} />
        <path className="hd-fill" d={`M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`} pathLength={100} />
        {Array.from({ length: MAX + 1 }, (_, h) => {
          const outer = point(h, R + 12);
          const inner = point(h, h % 2 === 0 ? R + 5 : R + 8);
          const cls = h === 8 ? "hd-tick good" : h === 12 ? "hd-tick peak" : "hd-tick";
          return <line key={h} className={cls} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />;
        })}
        {[0, 4, 8, 12, 14].map((h) => {
          const p = point(h, R - 16);
          return (
            <text key={h} className={`hd-num${h === 8 ? " good" : h === 12 ? " peak" : ""}`} x={p.x} y={p.y + 3} textAnchor="middle">
              {h}
            </text>
          );
        })}
        {hours > 0 ? <circle className="hd-tip" cx={tip.x} cy={tip.y} r="5" /> : null}
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
    </div>
  );
}
