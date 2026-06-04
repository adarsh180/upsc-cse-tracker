"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";

import { AppTile, SCREEN_APPS } from "@/components/goals/app-icons";

export type ScreenTimeRow = { date: string } & Record<string, number | string>;

const DISTRACTION_APPS = SCREEN_APPS.filter((a) => a.key !== "youtubeStudy");
const STUDY_KEY = "youtubeStudy";
const STUDY_APP = SCREEN_APPS.find((a) => a.key === STUDY_KEY)!;

type ViewKey = "today" | "7d" | "monthly" | "yearly";
const VIEWS: Array<{ key: ViewKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

type Bucket = { label: string; total: number; distraction: number; study: number } & Record<string, number | string>;

function num(row: ScreenTimeRow | undefined, key: string): number {
  return row ? Number(row[key]) || 0 : 0;
}

function bucketFromRows(label: string, rows: ScreenTimeRow[]): Bucket {
  const b: Bucket = { label, total: 0, distraction: 0, study: 0 };
  for (const app of SCREEN_APPS) {
    const sum = rows.reduce((s, r) => s + num(r, app.key), 0);
    b[app.key] = Number(sum.toFixed(2));
    if (app.key === STUDY_KEY) b.study += sum;
    else b.distraction += sum;
  }
  b.total = Number((b.distraction + b.study).toFixed(2));
  b.distraction = Number(b.distraction.toFixed(2));
  b.study = Number(b.study.toFixed(2));
  return b;
}

function addDays(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function StackTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const b = payload[0]?.payload as Bucket | undefined;
  if (!b) return null;
  const parts = DISTRACTION_APPS.map((a) => ({ a, v: Number(b[a.key]) || 0 }))
    .filter((p) => p.v > 0)
    .sort((x, y) => y.v - x.v);
  return (
    <div className="goals-chart-tooltip">
      <strong>{b.label}</strong>
      <div>
        <span style={{ color: "var(--text)" }}>Distraction: {b.distraction}h · Study YT: {b.study}h</span>
        {parts.map((p) => (
          <span key={p.a.key} style={{ color: p.a.solid }}>
            <i style={{ background: p.a.solid }} />
            {p.a.label}: {p.v}h
          </span>
        ))}
      </div>
    </div>
  );
}

export function ScreenTimeAnalytics({ rows, todayKey }: { rows: ScreenTimeRow[]; todayKey: string }) {
  const [view, setView] = useState<ViewKey>("7d");

  const byDate = useMemo(() => {
    const map = new Map<string, ScreenTimeRow>();
    rows.forEach((r) => map.set(r.date, r));
    return map;
  }, [rows]);

  const todayBucket = useMemo(() => bucketFromRows("Today", [byDate.get(todayKey) ?? ({ date: todayKey } as ScreenTimeRow)]), [byDate, todayKey]);

  const buckets = useMemo<Bucket[]>(() => {
    if (view === "today") return [todayBucket];
    if (view === "7d") {
      const out: Bucket[] = [];
      for (let i = 6; i >= 0; i--) {
        const key = addDays(todayKey, -i);
        const label = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }).format(
          new Date(`${key}T00:00:00Z`),
        );
        out.push(bucketFromRows(label, [byDate.get(key) ?? ({ date: key } as ScreenTimeRow)]));
      }
      return out;
    }
    // monthly / yearly grouping
    const groups = new Map<string, ScreenTimeRow[]>();
    for (const r of rows) {
      const k = view === "monthly" ? r.date.slice(0, 7) : r.date.slice(0, 4);
      const arr = groups.get(k) ?? [];
      arr.push(r);
      groups.set(k, arr);
    }
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(view === "monthly" ? -12 : -6)
      .map(([k, grp]) => {
        const label =
          view === "monthly"
            ? new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
                new Date(`${k}-01T00:00:00Z`),
              )
            : k;
        return bucketFromRows(label, grp);
      });
  }, [view, rows, byDate, todayKey, todayBucket]);

  const kpi = useMemo(() => {
    const totalDistraction = buckets.reduce((s, b) => s + b.distraction, 0);
    const totalStudy = buckets.reduce((s, b) => s + b.study, 0);
    const avg = buckets.length ? totalDistraction / buckets.length : 0;
    const worst = buckets.reduce((m, b) => (b.distraction > m ? b.distraction : m), 0);
    const appTotals = DISTRACTION_APPS.map((a) => ({
      a,
      v: buckets.reduce((s, b) => s + (Number(b[a.key]) || 0), 0),
    })).sort((x, y) => y.v - x.v);
    const top = appTotals[0];
    const avgLabel = view === "today" ? "today" : view === "7d" ? "/ day" : view === "monthly" ? "/ month" : "/ year";
    return {
      totalDistraction: Number(totalDistraction.toFixed(1)),
      totalStudy: Number(totalStudy.toFixed(1)),
      avg: Number(avg.toFixed(1)),
      avgLabel,
      worst: Number(worst.toFixed(1)),
      top: top && top.v > 0 ? top : null,
    };
  }, [buckets, view]);

  return (
    <div className="screen-time-analytics">
      <div className="goals-analytics-tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={v.key === view}
            className={`goals-analytics-tab${v.key === view ? " active" : ""}`}
            style={{ "--tab-accent": "var(--rose-bright)" } as CSSProperties}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="screen-time-kpis">
        <div className="screen-time-kpi">
          <span>{view === "today" ? "Distraction today" : "Total distraction"}</span>
          <strong style={{ color: kpi.totalDistraction >= (view === "today" ? 3 : 14) ? "var(--danger)" : "var(--text)" }}>
            {kpi.totalDistraction}h
          </strong>
        </div>
        {view !== "today" && (
          <div className="screen-time-kpi">
            <span>Avg {kpi.avgLabel}</span>
            <strong>{kpi.avg}h</strong>
          </div>
        )}
        <div className="screen-time-kpi">
          <span>Study YouTube</span>
          <strong style={{ color: "hsl(148,62%,56%)" }}>{kpi.totalStudy}h</strong>
        </div>
        <div className="screen-time-kpi">
          <span>Top sink</span>
          <strong className="screen-time-kpi-top">
            {kpi.top ? (
              <>
                <AppTile app={kpi.top.a} size={22} />
                {kpi.top.a.label}
              </>
            ) : (
              "—"
            )}
          </strong>
        </div>
      </div>

      {view === "today" ? (
        <div className="screen-time-today">
          {DISTRACTION_APPS.map((a) => ({ a, v: Number(todayBucket[a.key]) || 0 }))
            .concat([{ a: SCREEN_APPS.find((x) => x.key === STUDY_KEY)!, v: todayBucket.study }])
            .filter((p) => p.v > 0)
            .sort((x, y) => y.v - x.v)
            .map((p) => {
              const max = Math.max(0.5, ...DISTRACTION_APPS.map((a) => Number(todayBucket[a.key]) || 0), todayBucket.study);
              return (
                <div key={p.a.key} className="screen-time-today-row">
                  <AppTile app={p.a} size={30} />
                  <span className="screen-time-today-label">{p.a.label}</span>
                  <div className="screen-time-today-bar">
                    <span style={{ width: `${(p.v / max) * 100}%`, background: p.a.solid }} />
                  </div>
                  <strong>{p.v}h</strong>
                </div>
              );
            })}
          {todayBucket.total === 0 && (
            <div className="screen-time-empty">No screen time logged for today yet. Log it above to see the breakdown.</div>
          )}
        </div>
      ) : (
        <>
          <div className="screen-time-plot">
            <ResponsiveContainer>
              <BarChart data={buckets} margin={{ top: 14, right: 14, bottom: 4, left: -10 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.46)" tick={{ fontSize: 11, fontWeight: 700 }} minTickGap={10} />
                <YAxis tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.42)" tick={{ fontSize: 11, fontWeight: 700 }} width={32} tickFormatter={(v) => `${v}h`} />
                <Tooltip content={<StackTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                {DISTRACTION_APPS.map((a, i) => (
                  <Bar
                    key={a.key}
                    dataKey={a.key}
                    stackId="distraction"
                    fill={a.solid}
                    fillOpacity={0.92}
                    radius={i === DISTRACTION_APPS.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    animationDuration={680}
                  />
                ))}
                <Bar
                  dataKey={STUDY_KEY}
                  stackId="study"
                  fill={STUDY_APP.solid}
                  fillOpacity={0.82}
                  radius={[6, 6, 0, 0]}
                  animationDuration={760}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="screen-time-legend">
            {DISTRACTION_APPS.map((a) => (
              <span key={a.key} className="screen-time-legend-item">
                <i style={{ background: a.solid }} />
                {a.label}
              </span>
            ))}
            <span className="screen-time-legend-item screen-time-legend-study">
              <i style={{ background: STUDY_APP.solid }} />
              YouTube study
            </span>
          </div>
        </>
      )}
    </div>
  );
}
