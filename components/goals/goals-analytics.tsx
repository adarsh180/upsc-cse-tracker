"use client";

import { useMemo, useState, type CSSProperties } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

export type GoalPoint = {
  label: string;
  hours: number;
  questions: number;
  topics: number;
  completion: number;
  discipline: number;
};

type ViewKey = "hours" | "output" | "quality" | "balance";

const VIEWS: Array<{ key: ViewKey; label: string; hint: string; accent: string }> = [
  { key: "hours", label: "Study hours", hint: "Daily depth vs the 8h / 12h bars", accent: "var(--physics)" },
  { key: "output", label: "Output", hint: "Questions solved & topics covered", accent: "var(--botany)" },
  { key: "quality", label: "Quality", hint: "Discipline vs completion", accent: "var(--gold)" },
  { key: "balance", label: "Balance", hint: "Latest day vs your 7-day rhythm", accent: "var(--lotus-bright)" },
];

const GOOD_LINE = 8;
const PEAK_LINE = 12;

function GenericTooltip({ active, payload, label, items }: TooltipProps<number, string> & {
  items: Array<{ key: string; label: string; suffix?: string; color: string }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as Record<string, number> | undefined;
  if (!point) return null;
  return (
    <div className="goals-chart-tooltip">
      <strong>{label}</strong>
      <div>
        {items.map((it) => (
          <span key={it.key} style={{ color: it.color }}>
            <i style={{ background: it.color }} />
            {it.label}: {point[it.key]}
            {it.suffix ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function hoursTone(h: number) {
  if (h >= 12) return "hsl(38, 96%, 60%)";
  if (h >= 10) return "hsl(168, 70%, 54%)";
  if (h >= 8) return "hsl(148, 62%, 52%)";
  if (h >= 6) return "hsl(28, 92%, 60%)";
  if (h >= 4) return "hsl(199, 78%, 60%)";
  return "hsl(210, 22%, 52%)";
}

export function GoalsAnalytics({ data }: { data: GoalPoint[] }) {
  const [view, setView] = useState<ViewKey>("hours");
  const hasData = data.length > 0;
  const points = hasData
    ? data
    : [{ label: "No data", hours: 0, questions: 0, topics: 0, completion: 0, discipline: 0 }];

  const maxHours = Math.max(14, ...points.map((p) => p.hours + 1));

  const radarData = useMemo(() => {
    const recent = data.slice(-7);
    const avg = (sel: (p: GoalPoint) => number, max: number) =>
      recent.length ? Math.round((recent.reduce((s, p) => s + sel(p), 0) / recent.length / max) * 100) : 0;
    const latest = data[data.length - 1];
    const norm = (v: number, max: number) => Math.min(100, Math.round((v / max) * 100));
    const maxQ = Math.max(1, ...data.map((p) => p.questions));
    const maxT = Math.max(1, ...data.map((p) => p.topics));
    return [
      { axis: "Hours", latest: latest ? norm(latest.hours, 14) : 0, avg: avg((p) => p.hours, 14) },
      { axis: "Questions", latest: latest ? norm(latest.questions, maxQ) : 0, avg: avg((p) => p.questions, maxQ) },
      { axis: "Topics", latest: latest ? norm(latest.topics, maxT) : 0, avg: avg((p) => p.topics, maxT) },
      { axis: "Discipline", latest: latest ? latest.discipline : 0, avg: avg((p) => p.discipline, 100) },
      { axis: "Completion", latest: latest ? latest.completion : 0, avg: avg((p) => p.completion, 100) },
    ];
  }, [data]);

  const activeView = VIEWS.find((v) => v.key === view)!;

  return (
    <div className="goals-analytics">
      <div className="goals-analytics-tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={v.key === view}
            className={`goals-analytics-tab${v.key === view ? " active" : ""}`}
            style={{ "--tab-accent": v.accent } as CSSProperties}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="goals-analytics-hint">{activeView.hint}</div>

      <div className="goals-analytics-plot">
        {view === "hours" && (
          <ResponsiveContainer>
            <BarChart data={points} margin={{ top: 16, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.46)" tick={{ fontSize: 11, fontWeight: 700 }} minTickGap={16} />
              <YAxis domain={[0, Math.ceil(maxHours)]} tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.42)" tick={{ fontSize: 11, fontWeight: 700 }} width={30} />
              <Tooltip content={<GenericTooltip items={[{ key: "hours", label: "Hours", suffix: "h", color: "var(--physics)" }]} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <ReferenceLine y={GOOD_LINE} stroke="hsl(148,62%,52%)" strokeDasharray="5 5" strokeWidth={1.5}
                label={{ value: "Good 8h", position: "right", fill: "hsl(148,62%,62%)", fontSize: 10, fontWeight: 800 }} />
              <ReferenceLine y={PEAK_LINE} stroke="hsl(38,96%,60%)" strokeDasharray="5 5" strokeWidth={1.5}
                label={{ value: "Peak 12h", position: "right", fill: "hsl(38,96%,66%)", fontSize: 10, fontWeight: 800 }} />
              <Bar dataKey="hours" barSize={20} radius={[8, 8, 3, 3]} animationDuration={760}>
                {points.map((p, i) => (
                  <Cell key={i} fill={hoursTone(p.hours)} fillOpacity={0.92} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {view === "output" && (
          <ResponsiveContainer>
            <ComposedChart data={points} margin={{ top: 16, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.46)" tick={{ fontSize: 11, fontWeight: 700 }} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.42)" tick={{ fontSize: 11, fontWeight: 700 }} width={30} />
              <Tooltip content={<GenericTooltip items={[
                { key: "questions", label: "Questions", color: "var(--botany)" },
                { key: "topics", label: "Topics", color: "var(--gold)" },
              ]} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="questions" barSize={18} radius={[8, 8, 3, 3]} fill="rgba(101,240,181,0.5)" animationDuration={760} />
              <Line type="monotone" dataKey="topics" stroke="var(--gold)" strokeWidth={3} dot={false} strokeLinecap="round" animationDuration={960} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {view === "quality" && (
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 16, right: 16, bottom: 4, left: -8 }}>
              <defs>
                <linearGradient id="goals-q-disc" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.4} />
                  <stop offset="78%" stopColor="var(--gold)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.46)" tick={{ fontSize: 11, fontWeight: 700 }} minTickGap={16} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="rgba(238,232,217,0.42)" tick={{ fontSize: 11, fontWeight: 700 }} width={30} tickFormatter={(v) => `${v}`} />
              <Tooltip content={<GenericTooltip items={[
                { key: "discipline", label: "Discipline", suffix: "/100", color: "var(--gold)" },
                { key: "completion", label: "Completion", suffix: "%", color: "var(--rose-bright)" },
              ]} />} cursor={{ stroke: "rgba(255,255,255,0.14)", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="discipline" stroke="var(--gold)" strokeWidth={3} fill="url(#goals-q-disc)" dot={false} strokeLinecap="round" animationDuration={900} />
              <Line type="monotone" dataKey="completion" stroke="var(--rose-bright)" strokeWidth={2.6} dot={false} strokeLinecap="round" animationDuration={1040} />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {view === "balance" && (
          <ResponsiveContainer>
            <RadarChart data={radarData} outerRadius="74%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fontWeight: 800, fill: "rgba(238,232,217,0.7)" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip content={<GenericTooltip items={[
                { key: "latest", label: "Latest", color: "var(--physics)" },
                { key: "avg", label: "7-day avg", color: "var(--lotus-bright)" },
              ]} />} />
              <Radar name="7-day avg" dataKey="avg" stroke="var(--lotus-bright)" fill="var(--lotus-bright)" fillOpacity={0.16} strokeWidth={2} animationDuration={900} />
              <Radar name="Latest" dataKey="latest" stroke="var(--physics)" fill="var(--physics)" fillOpacity={0.26} strokeWidth={2.4} animationDuration={1040} />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
