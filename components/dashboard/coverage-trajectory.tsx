"use client";

import { useMemo, useState } from "react";

import { useWidth } from "@/components/su/use-width";

const DAY = 86_400_000;
const t = (key: string) => new Date(key.length > 10 ? key : `${key}T00:00:00Z`).getTime();
const fmt = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

export function CoverageTrajectory({
  timeline,
  total,
  done,
  perWeek,
  today,
  prelimsDate,
  mainsDate,
}: {
  timeline: Array<{ date: string; done: number }>;
  total: number;
  done: number;
  perWeek: number;
  today: string;
  prelimsDate: string;
  mainsDate: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(900);
  const [hover, setHover] = useState<number | null>(null);

  const start = timeline.length ? t(timeline[0].date) : t(today) - 30 * DAY;
  const now = t(today);
  const pre = t(prelimsDate.slice(0, 10));
  const mains = t(mainsDate.slice(0, 10));
  const end = Math.max(mains, now + DAY);
  const perDay = perWeek / 7;
  const needPerDay = Math.max(0, total - done) / Math.max(1, (mains - now) / DAY);
  const atPre = Math.min(total, done + perDay * Math.max(0, (pre - now) / DAY));
  const atMains = Math.min(total, done + perDay * Math.max(0, (mains - now) / DAY));

  const H = 300;
  const pad = { l: 46, r: 12, t: 22, b: 30 };
  const plotW = Math.max(100, width - pad.l - pad.r);
  const plotH = H - pad.t - pad.b;
  // Scale to the syllabus, but never so tall that real progress is invisible.
  const yMax = total;
  const x = (ms: number) => pad.l + ((ms - start) / (end - start)) * plotW;
  const y = (v: number) => pad.t + plotH - (v / yMax) * plotH;

  const actual = timeline
    .map((p, i) => `${i ? "L" : "M"}${x(t(p.date)).toFixed(1)} ${y(p.done).toFixed(1)}`)
    .join(" ");
  const area = actual ? `${actual} L${x(now).toFixed(1)} ${y(0)} L${x(start).toFixed(1)} ${y(0)} Z` : "";

  const valueAt = (ms: number) => {
    if (ms <= now) {
      let v = timeline[0]?.done ?? 0;
      for (const p of timeline) if (t(p.date) <= ms) v = p.done;
      return { v, kind: "Ticked" };
    }
    return { v: Math.min(total, done + perDay * ((ms - now) / DAY)), kind: "At your pace" };
  };

  const ticks = useMemo(() => {
    const out: number[] = [];
    const d = new Date(start);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const span = (end - start) / (30 * DAY);
    const every = span > 14 ? 3 : span > 7 ? 2 : 1;
    while (d.getTime() < end) {
      out.push(d.getTime());
      d.setUTCMonth(d.getUTCMonth() + every);
    }
    return out;
  }, [start, end]);

  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = Math.max(0, Math.min(plotW, event.clientX - box.left - pad.l));
    setHover(start + (px / plotW) * (end - start));
  };
  const hv = hover !== null ? valueAt(hover) : null;

  return (
    <div className="ct">
      <div className="ct-plot" ref={ref}>
        <svg width={width} height={H} role="img" aria-label="Syllabus topics ticked over time with projections to Prelims and Mains">
          <defs>
            <linearGradient id="ct-fill" x1="0" y1="0" x2="0" y2="1">
              <stop className="ct-f0" offset="0%" />
              <stop className="ct-f1" offset="100%" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f} className="ct-grid">
              <line x1={pad.l} x2={pad.l + plotW} y1={y(total * f)} y2={y(total * f)} />
              <text x={pad.l - 8} y={y(total * f) + 3.5} textAnchor="end">{Math.round(f * 100)}%</text>
            </g>
          ))}
          <line className="ct-base" x1={pad.l} x2={pad.l + plotW} y1={y(0)} y2={y(0)} />
          {ticks.map((ms) => (
            <text key={ms} className="ct-x" x={x(ms)} y={H - 9} textAnchor="middle">
              {new Date(ms).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}
            </text>
          ))}

          {[{ ms: pre, label: "Prelims" }, { ms: mains, label: "Mains" }].map((m) => (
            <g key={m.label} className="ct-exam">
              <line x1={x(m.ms)} x2={x(m.ms)} y1={pad.t - 6} y2={y(0)} />
              <text x={x(m.ms) - 6} y={pad.t + 4} textAnchor="end">{m.label}</text>
            </g>
          ))}

          {/* Required pace: today → whole syllabus by Mains */}
          <path className="ct-need" d={`M${x(now)} ${y(done)} L${x(mains)} ${y(total)}`} pathLength={1} />
          {/* Your pace projection */}
          <path className="ct-pace" d={`M${x(now)} ${y(done)} L${x(mains)} ${y(atMains)}`} pathLength={1} />
          {area ? <path className="ct-area" d={area} fill="url(#ct-fill)" /> : null}
          {actual ? <path className="ct-actual" d={actual} pathLength={1} /> : null}
          <circle className="ct-now" cx={x(now)} cy={y(done)} r={4.5} />
          <circle className="ct-at" cx={x(pre)} cy={y(atPre)} r={3.5} />

          {hover !== null && hv ? (
            <g className="ct-cross">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} />
              <circle cx={x(hover)} cy={y(hv.v)} r={4} />
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
        {hover !== null && hv ? (
          <div className="su-tip su-glass" style={{ left: Math.min(width - 90, Math.max(90, x(hover))), top: y(hv.v) }}>
            <span className="k">{fmt(hover)}</span>
            <strong>{Math.round(hv.v).toLocaleString("en-IN")} topics</strong>
            <div className="row"><span>{hv.kind}</span><b>{((hv.v / total) * 100).toFixed(1)}%</b></div>
            {hover > now ? (
              <div className="row"><span>Needed by then</span><b>{Math.round(Math.min(total, done + needPerDay * ((hover - now) / DAY))).toLocaleString("en-IN")}</b></div>
            ) : null}
          </div>
        ) : null}
      </div>
      <dl className="ct-legend">
        <div className="is-actual"><dt>Ticked so far</dt><dd>{done.toLocaleString("en-IN")} <small>of {total.toLocaleString("en-IN")}</small></dd></div>
        <div className="is-pace"><dt>Your pace · {perWeek.toFixed(0)}/week</dt><dd>{Math.round((atPre / total) * 100)}% <small>by Prelims</small></dd></div>
        <div className="is-need"><dt>To finish by Mains</dt><dd>{Math.ceil(needPerDay * 7)} <small>topics / week</small></dd></div>
      </dl>
    </div>
  );
}
