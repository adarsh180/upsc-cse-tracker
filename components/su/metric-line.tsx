"use client";

import { useId, useMemo, useState } from "react";

import { useWidth } from "@/components/su/use-width";

export type MetricDef = {
  key: string;
  label: string;
  suffix?: string;
  /** Fixed y max (e.g. 100 for percentages); otherwise derived from data. */
  max?: number;
  tone?: "acc" | "good" | "warn" | "bad" | "ink";
  decimals?: number;
  /** Reference line, e.g. a cut-off or target. */
  target?: { value: number; label: string };
};

export type MetricPoint = { x: string; sub?: string; values: Record<string, number | null> };

const TONE: Record<NonNullable<MetricDef["tone"]>, string> = {
  acc: "var(--su-acc)",
  good: "var(--su-good)",
  warn: "var(--su-warn)",
  bad: "var(--su-bad)",
  ink: "var(--su-ink)",
};

// Catmull-Rom → cubic Bézier, so lines read as one continuous gesture.
function smooth(points: Array<[number, number]>) {
  if (points.length < 2) return points.length ? `M${points[0][0]} ${points[0][1]}` : "";
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const t = points.length > 40 ? 0.08 : 0.18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    // Keep control points within the segment's span so curves never overshoot (no dips below zero).
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    c1[1] = Math.min(hi, Math.max(lo, c1[1]));
    c2[1] = Math.min(hi, Math.max(lo, c2[1]));
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

const fmt = (v: number, d = 1) => (Number.isInteger(v) ? String(v) : v.toFixed(d));

/**
 * One instrument, several signals: a segmented switch picks the metric, the
 * line redraws, and scrubbing reads any point. Used on Tests and Performance.
 */
export function MetricLine({
  series,
  metrics,
  height = 300,
  emptyText = "Nothing logged yet.",
}: {
  series: MetricPoint[];
  metrics: MetricDef[];
  height?: number;
  emptyText?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const [active, setActive] = useState(metrics[0]?.key);
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>(900);
  const metric = metrics.find((m) => m.key === active) ?? metrics[0];
  const color = TONE[metric?.tone ?? "acc"];

  const pts = useMemo(
    () => series.map((p, i) => ({ i, p, v: p.values[metric.key] })).filter((d): d is { i: number; p: MetricPoint; v: number } => typeof d.v === "number" && Number.isFinite(d.v)),
    [series, metric.key],
  );

  if (!metric) return null;

  const values = pts.map((d) => d.v);
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  const latest = values.at(-1);
  const first = values[0];
  const best = values.length ? Math.max(...values) : 0;
  const yMax = metric.max ?? Math.max(1, Math.ceil((Math.max(best, metric.target?.value ?? 0) * 1.15) / 5) * 5);

  const pad = { l: 40, r: 14, t: 22, b: 30 };
  const plotW = Math.max(100, width - pad.l - pad.r);
  const plotH = height - pad.t - pad.b;
  const n = Math.max(1, series.length - 1);
  const x = (i: number) => pad.l + (series.length === 1 ? plotW / 2 : (i / n) * plotW);
  const y = (v: number) => pad.t + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const coords = pts.map((d) => [x(d.i), y(d.v)] as [number, number]);
  const line = smooth(coords);
  const area = coords.length ? `${line} L${coords.at(-1)![0].toFixed(1)} ${y(0)} L${coords[0][0].toFixed(1)} ${y(0)} Z` : "";
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(3, Math.floor(plotW / 86))));
  const hv = hover !== null ? pts.find((d) => d.i === hover) ?? null : null;

  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    if (!pts.length) return;
    const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = event.clientX - box.left;
    let bestI = pts[0].i;
    let bestD = Infinity;
    for (const d of pts) {
      const dist = Math.abs(x(d.i) - px);
      if (dist < bestD) {
        bestD = dist;
        bestI = d.i;
      }
    }
    setHover(bestI);
  };

  const sfx = metric.suffix ?? "";
  const dec = metric.decimals ?? 1;

  return (
    <div className="ml" style={{ "--ml": color } as React.CSSProperties}>
      <div className="ml-head">
        <div className="ml-read">
          <span className="ml-kicker">{metric.label}</span>
          <span className="ml-big">
            {latest === undefined ? "—" : fmt(latest, dec)}
            <small>{sfx}</small>
          </span>
          <span className="ml-meta">
            latest · avg {fmt(avg, dec)}{sfx} · best {fmt(best, dec)}{sfx}
            {first !== undefined && latest !== undefined && values.length > 1 ? (
              <b className={latest >= first ? "up" : "down"}>
                {" "}
                {latest >= first ? "▲" : "▼"} {fmt(Math.abs(latest - first), dec)}
                {sfx} since first
              </b>
            ) : null}
          </span>
        </div>
        {metrics.length > 1 ? (
          <div className="su-seg ml-seg" style={{ "--n": metrics.length, "--i": metrics.findIndex((m) => m.key === metric.key) } as React.CSSProperties}>
            {metrics.map((m) => (
              <button key={m.key} type="button" aria-pressed={m.key === metric.key} onClick={() => setActive(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="ml-plot" ref={ref}>
        {!pts.length ? (
          <div className="su-empty">{emptyText}</div>
        ) : (
          <svg width={width} height={height} role="img" aria-label={`${metric.label} over time`}>
            <defs>
              <linearGradient id={`ml-${uid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <g key={f} className="ml-grid">
                <line x1={pad.l} x2={pad.l + plotW} y1={y(yMax * f)} y2={y(yMax * f)} />
                <text x={pad.l - 8} y={y(yMax * f) + 3.5} textAnchor="end">{fmt(yMax * f, 0)}</text>
              </g>
            ))}
            <line className="ml-base" x1={pad.l} x2={pad.l + plotW} y1={y(0)} y2={y(0)} />
            {metric.target ? (
              <g className="ml-target">
                <line x1={pad.l} x2={pad.l + plotW} y1={y(metric.target.value)} y2={y(metric.target.value)} />
                <text x={pad.l + plotW} y={y(metric.target.value) - 6} textAnchor="end">{metric.target.label}</text>
              </g>
            ) : null}
            <line className="ml-avg" x1={pad.l} x2={pad.l + plotW} y1={y(avg)} y2={y(avg)} />
            <g key={metric.key}>
              <path className="ml-area" d={area} fill={`url(#ml-${uid})`} />
              <path className="ml-line" d={line} pathLength={1} />
              {pts.map((d) => (
                <circle key={d.i} className={`ml-dot${hover === d.i ? " is-hover" : ""}`} cx={x(d.i)} cy={y(d.v)} r={series.length > 40 ? 0 : 3.5} />
              ))}
            </g>
            {series.map((p, i) =>
              i % labelEvery === 0 || i === series.length - 1 ? (
                <text key={i} className="ml-x" x={x(i)} y={height - 9} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}>
                  {p.x}
                </text>
              ) : null,
            )}
            {hv ? (
              <g className="ml-cross">
                <line x1={x(hv.i)} x2={x(hv.i)} y1={pad.t} y2={y(0)} />
                <circle cx={x(hv.i)} cy={y(hv.v)} r={5} />
              </g>
            ) : null}
            <rect
              className="ml-hit"
              x={pad.l - 10}
              y={pad.t}
              width={plotW + 20}
              height={plotH}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}
        {hv ? (
          <div className="su-tip su-glass" style={{ left: Math.min(width - 90, Math.max(90, x(hv.i))), top: y(hv.v) }}>
            <span className="k">{hv.p.x}</span>
            <strong>
              {fmt(hv.v, dec)}
              {sfx}
            </strong>
            {hv.p.sub ? <div className="row"><span>{hv.p.sub}</span></div> : null}
            {metrics
              .filter((m) => m.key !== metric.key && typeof hv.p.values[m.key] === "number")
              .slice(0, 3)
              .map((m) => (
                <div className="row" key={m.key}>
                  <span>{m.label}</span>
                  <b>
                    {fmt(hv.p.values[m.key] as number, m.decimals ?? 1)}
                    {m.suffix ?? ""}
                  </b>
                </div>
              ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
