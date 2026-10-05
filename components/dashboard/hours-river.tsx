"use client";

import { useMemo, useState } from "react";

import { useWidth } from "@/components/su/use-width";
import type { HoursPoint } from "@/lib/insights";

const RANGES = [
  { id: "30", label: "30 days", days: 30 },
  { id: "90", label: "90 days", days: 90 },
  { id: "all", label: "All", days: 0 },
] as const;

type Day = { date: string; hours: number | null; point: HoursPoint | null; avg: number };

function addDays(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const fmtDate = (key: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

export function HoursRiver({ series, today }: { series: HoursPoint[]; today: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("90");
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>(900);

  const all = useMemo<Day[]>(() => {
    if (!series.length) return [];
    const byDate = new Map(series.map((p) => [p.date, p]));
    const days: Day[] = [];
    for (let key = series[0].date; key <= today; key = addDays(key, 1)) {
      const p = byDate.get(key) ?? null;
      days.push({ date: key, hours: p ? p.hours : null, point: p, avg: 0 });
    }
    // 7-day calendar average (unlogged days count as zero — honest pace).
    for (let i = 0; i < days.length; i++) {
      let sum = 0;
      const from = Math.max(0, i - 6);
      for (let j = from; j <= i; j++) sum += days[j].hours ?? 0;
      days[i].avg = sum / (i - from + 1);
    }
    return days;
  }, [series, today]);

  const days = useMemo(() => {
    const r = RANGES.find((x) => x.id === range)!;
    return r.days ? all.slice(-r.days) : all;
  }, [all, range]);

  const H = 290;
  const pad = { l: 34, r: 8, t: 18, b: 28 };
  const plotW = Math.max(100, width - pad.l - pad.r);
  const plotH = H - pad.t - pad.b;
  const maxH = Math.max(14, Math.ceil(Math.max(...days.map((d) => d.hours ?? 0), 0)));
  const step = days.length ? plotW / days.length : plotW;
  const barW = Math.max(1.5, Math.min(14, step * 0.62));
  const y = (h: number) => pad.t + plotH - (h / maxH) * plotH;
  const x = (i: number) => pad.l + step * i + step / 2;

  const avgPath = days
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.avg).toFixed(1)}`)
    .join(" ");

  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(3, Math.floor(plotW / 90))));
  const hovered = hover !== null ? days[hover] : null;

  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = event.clientX - box.left - pad.l;
    const i = Math.max(0, Math.min(days.length - 1, Math.floor(px / step)));
    setHover(i);
  };

  if (!days.length) {
    return (
      <div className="su-empty">
        <strong>No daily logs yet</strong>
        Log today on the Goals page and this river starts flowing.
      </div>
    );
  }

  return (
    <div className="hr">
      <div className="hr-tools">
        <div className="hr-legend">
          <span><i className="lg-bar peak" />12h+ peak</span>
          <span><i className="lg-bar good" />8h+ target</span>
          <span><i className="lg-bar low" />below 8h</span>
          <span><i className="lg-line" />7-day average</span>
        </div>
        <div className="su-seg" style={{ "--n": RANGES.length, "--i": RANGES.findIndex((r) => r.id === range) } as React.CSSProperties}>
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hr-plot" ref={ref}>
        <svg width={width} height={H} role="img" aria-label="Daily study hours with a seven-day average">
          {[4, 8, 12].filter((g) => g <= maxH).map((g) => (
            <g key={g} className={`hr-grid${g === 8 ? " is-target" : g === 12 ? " is-peak" : ""}`}>
              <line x1={pad.l} x2={pad.l + plotW} y1={y(g)} y2={y(g)} />
              <text x={pad.l - 8} y={y(g) + 3.5} textAnchor="end">{g}h</text>
            </g>
          ))}
          <line className="hr-base" x1={pad.l} x2={pad.l + plotW} y1={y(0)} y2={y(0)} />
          <g className="hr-bars" key={range}>
            {days.map((d, i) =>
              d.hours === null ? (
                <circle key={d.date} className="hr-miss" cx={x(i)} cy={y(0) - 3} r={Math.min(1.6, barW / 2)} />
              ) : (
                <rect
                  key={d.date}
                  className={`hr-bar ${d.hours >= 12 ? "peak" : d.hours >= 8 ? "good" : "low"}${hover === i ? " is-hover" : ""}`}
                  x={x(i) - barW / 2}
                  y={y(d.hours)}
                  width={barW}
                  height={Math.max(1, y(0) - y(d.hours))}
                  rx={Math.min(barW / 2, 4)}
                  style={{ "--i": i } as React.CSSProperties}
                />
              ),
            )}
          </g>
          <path className="hr-avg" d={avgPath} key={`avg-${range}`} pathLength={1} />
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.date} className="hr-x" x={x(i)} y={H - 8} textAnchor="middle">
                {fmtDate(d.date)}
              </text>
            ) : null,
          )}
          {hovered ? (
            <g className="hr-cross">
              <line x1={x(hover!)} x2={x(hover!)} y1={pad.t} y2={y(0)} />
              <circle cx={x(hover!)} cy={y(hovered.avg)} r={3.5} />
            </g>
          ) : null}
          <rect
            className="hr-hit"
            x={pad.l}
            y={pad.t}
            width={plotW}
            height={plotH}
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hovered ? (
          <div
            className="su-tip su-glass"
            style={{
              left: Math.min(width - 90, Math.max(90, x(hover!))),
              top: y(Math.max(hovered.hours ?? 0, hovered.avg)),
            }}
          >
            <span className="k">{fmtDate(hovered.date, { weekday: "short", day: "numeric", month: "short" })}</span>
            <strong>{hovered.hours === null ? "No log" : `${hovered.hours}h`}</strong>
            {hovered.point ? (
              <>
                <div className="row"><span>Focus</span><b>{hovered.point.focus.slice(0, 22)}</b></div>
                <div className="row"><span>Discipline</span><b>{hovered.point.discipline || "—"}</b></div>
                <div className="row"><span>Completion</span><b>{hovered.point.completion}%</b></div>
              </>
            ) : null}
            <div className="row"><span>7-day avg</span><b>{hovered.avg.toFixed(1)}h</b></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
