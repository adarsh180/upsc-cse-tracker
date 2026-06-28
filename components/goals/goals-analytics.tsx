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
  { key: "hours", label: "Study hours", hint: "Daily depth against the 8h and 12h bars", accent: "var(--goals-blue)" },
  { key: "output", label: "Output", hint: "Questions solved and topics covered", accent: "var(--goals-success)" },
  { key: "quality", label: "Quality", hint: "Discipline and completion movement", accent: "var(--goals-gold)" },
  { key: "balance", label: "Latest vs rhythm", hint: "Latest day compared with your 7-day average", accent: "var(--goals-red)" },
];

const GOOD_LINE = 8;
const PEAK_LINE = 12;
const chartGrid = "var(--goals-chart-grid)";
const chartAxis = "var(--goals-chart-axis)";
const chartCursor = "var(--goals-chart-cursor)";

function GenericTooltip({
  active,
  payload,
  label,
  items,
}: TooltipProps<number, string> & {
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
  if (h >= 12) return "var(--goals-gold)";
  if (h >= 10) return "var(--goals-success-strong)";
  if (h >= 8) return "var(--goals-success)";
  if (h >= 6) return "var(--goals-warning)";
  if (h >= 4) return "var(--goals-blue)";
  return "var(--goals-muted)";
}

function axisProps() {
  return {
    tickLine: false,
    axisLine: false,
    stroke: chartAxis,
    tick: { fontSize: 11, fontWeight: 700, fill: chartAxis },
  };
}

export function GoalsAnalytics({ data }: { data: GoalPoint[] }) {
  const [view, setView] = useState<ViewKey>("hours");
  const hasData = data.length > 0;
  const points = hasData ? data : [{ label: "No data", hours: 0, questions: 0, topics: 0, completion: 0, discipline: 0 }];
  const maxHours = Math.max(14, ...points.map((p) => p.hours + 1));

  const radarData = useMemo(() => {
    const latest = data[data.length - 1];
    const recent = data.slice(-7);
    const avg = (sel: (p: GoalPoint) => number) =>
      recent.length ? Math.round((recent.reduce((sum, p) => sum + sel(p), 0) / recent.length) * 10) / 10 : 0;
    const bestQuestions = Math.max(1, ...data.map((p) => p.questions));
    const bestTopics = Math.max(1, ...data.map((p) => p.topics));

    return [
      { metric: "Hours", latest: latest?.hours ?? 0, rhythm: avg((p) => p.hours), max: 12 },
      { metric: "Questions", latest: latest?.questions ?? 0, rhythm: avg((p) => p.questions), max: bestQuestions },
      { metric: "Topics", latest: latest?.topics ?? 0, rhythm: avg((p) => p.topics), max: bestTopics },
      { metric: "Discipline", latest: latest?.discipline ?? 0, rhythm: avg((p) => p.discipline), max: 100 },
      { metric: "Completion", latest: latest?.completion ?? 0, rhythm: avg((p) => p.completion), max: 100 },
    ].map((row) => ({
      axis: row.metric,
      latest: Math.min(100, Math.round((row.latest / row.max) * 100)),
      rhythm: Math.min(100, Math.round((row.rhythm / row.max) * 100)),
      rawLatest: row.latest,
      rawRhythm: row.rhythm,
    }));
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
              <CartesianGrid stroke={chartGrid} vertical={false} />
              <XAxis dataKey="label" minTickGap={16} {...axisProps()} />
              <YAxis domain={[0, Math.ceil(maxHours)]} width={30} {...axisProps()} />
              <Tooltip
                content={<GenericTooltip items={[{ key: "hours", label: "Hours", suffix: "h", color: "var(--goals-blue)" }]} />}
                cursor={{ fill: chartCursor }}
              />
              <ReferenceLine
                y={GOOD_LINE}
                stroke="var(--goals-success)"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: "Good 8h", position: "right", fill: "var(--goals-success)", fontSize: 10, fontWeight: 800 }}
              />
              <ReferenceLine
                y={PEAK_LINE}
                stroke="var(--goals-gold)"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{ value: "Peak 12h", position: "right", fill: "var(--goals-gold)", fontSize: 10, fontWeight: 800 }}
              />
              <Bar dataKey="hours" barSize={20} radius={[6, 6, 2, 2]} animationDuration={680}>
                {points.map((p) => (
                  <Cell key={p.label} fill={hoursTone(p.hours)} fillOpacity={0.92} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {view === "output" && (
          <ResponsiveContainer>
            <ComposedChart data={points} margin={{ top: 16, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid stroke={chartGrid} vertical={false} />
              <XAxis dataKey="label" minTickGap={16} {...axisProps()} />
              <YAxis width={30} {...axisProps()} />
              <Tooltip
                content={
                  <GenericTooltip
                    items={[
                      { key: "questions", label: "Questions", color: "var(--goals-success)" },
                      { key: "topics", label: "Topics", color: "var(--goals-gold)" },
                    ]}
                  />
                }
                cursor={{ fill: chartCursor }}
              />
              <Bar dataKey="questions" barSize={18} radius={[6, 6, 2, 2]} fill="var(--goals-success)" fillOpacity={0.58} animationDuration={680} />
              <Line type="monotone" dataKey="topics" stroke="var(--goals-gold)" strokeWidth={2.7} dot={false} strokeLinecap="round" animationDuration={860} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {view === "quality" && (
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 16, right: 16, bottom: 4, left: -8 }}>
              <defs>
                <linearGradient id="goals-quality-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--goals-gold)" stopOpacity={0.34} />
                  <stop offset="78%" stopColor="var(--goals-gold)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartGrid} vertical={false} />
              <XAxis dataKey="label" minTickGap={16} {...axisProps()} />
              <YAxis domain={[0, 100]} width={30} tickFormatter={(v) => `${v}`} {...axisProps()} />
              <Tooltip
                content={
                  <GenericTooltip
                    items={[
                      { key: "discipline", label: "Discipline", suffix: "/100", color: "var(--goals-gold)" },
                      { key: "completion", label: "Completion", suffix: "%", color: "var(--goals-red)" },
                    ]}
                  />
                }
                cursor={{ stroke: chartCursor, strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="discipline"
                stroke="var(--goals-gold)"
                strokeWidth={2.8}
                fill="url(#goals-quality-fill)"
                dot={false}
                strokeLinecap="round"
                animationDuration={760}
              />
              <Line type="monotone" dataKey="completion" stroke="var(--goals-red)" strokeWidth={2.4} dot={false} strokeLinecap="round" animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {view === "balance" && (
          <div className="goals-radar-layout">
            <div className="goals-radar-explain">
              <strong>What this calculates</strong>
              <p>
                Latest is your most recent daily log. Rhythm is your 7-day average. Hours are scored against the 12h peak;
                questions and topics are scored against your best logged day; discipline and completion use their 0-100 values.
              </p>
            </div>
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="72%" margin={{ top: 10, right: 16, bottom: 10, left: 16 }}>
                <PolarGrid stroke={chartGrid} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fontWeight: 800, fill: chartAxis }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip
                  content={
                    <GenericTooltip
                      items={[
                        { key: "latest", label: "Latest score", suffix: "%", color: "var(--goals-blue)" },
                        { key: "rhythm", label: "7d rhythm", suffix: "%", color: "var(--goals-red)" },
                      ]}
                    />
                  }
                />
                <Radar
                  name="7-day rhythm"
                  dataKey="rhythm"
                  stroke="var(--goals-red)"
                  fill="var(--goals-red)"
                  fillOpacity={0.14}
                  strokeWidth={2}
                  animationDuration={780}
                />
                <Radar
                  name="Latest"
                  dataKey="latest"
                  stroke="var(--goals-blue)"
                  fill="var(--goals-blue)"
                  fillOpacity={0.24}
                  strokeWidth={2.4}
                  animationDuration={900}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
