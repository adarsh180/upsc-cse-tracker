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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, Clock, Gauge, LineChart as LineIcon, Layers, Smile } from "lucide-react";

export type ScorePoint = { label: string; scorePct: number; score: number; totalMarks: number };
export type DisciplinePoint = { label: string; discipline: number; completion: number };
export type HoursPoint = { label: string; hours: number };
export type SubjectPoint = { subject: string; hours: number; sessions: number };
export type MoodPoint = { label: string; focus: number; stress: number };

type Tab = "scores" | "discipline" | "hours" | "subjects" | "mood";

const TABS: Array<{ key: Tab; label: string; icon: typeof Gauge }> = [
  { key: "scores", label: "Scores", icon: Gauge },
  { key: "hours", label: "Study hours", icon: Clock },
  { key: "discipline", label: "Discipline", icon: LineIcon },
  { key: "subjects", label: "Subjects", icon: Layers },
  { key: "mood", label: "Mood", icon: Smile },
];

const C = {
  gold: "var(--gold-bright)",
  physics: "var(--physics)",
  botany: "var(--botany)",
  lotus: "var(--lotus-bright)",
  rose: "var(--rose-bright)",
};

function avg(values: number[]) {
  const usable = values.filter((v) => Number.isFinite(v));
  return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : 0;
}

const AXIS = {
  tickLine: false,
  axisLine: false,
  stroke: "rgba(238,232,217,0.42)",
  tick: { fontSize: 11, fontWeight: 700 },
} as const;

function Frame({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <div className="prem-chart perf-chart-xl" style={{ color: tone }}>
      <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
    </div>
  );
}

function GenericTooltip({ active, payload, label, rows }: {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, number> }>;
  label?: string | number;
  rows: Array<{ key: string; label: string; color: string; suffix?: string }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as Record<string, number> | undefined;
  if (!point) return null;
  return (
    <div className="prem-tooltip">
      <strong>{label}</strong>
      {rows.map((r) => (
        <span key={r.key} style={{ color: r.color }}>
          <i style={{ background: r.color }} />
          {r.label}: {point[r.key] ?? 0}
          {r.suffix ?? ""}
        </span>
      ))}
    </div>
  );
}

export function PerformanceAnalytics({
  scores,
  discipline,
  hours,
  subjects,
  mood,
}: {
  scores: ScorePoint[];
  discipline: DisciplinePoint[];
  hours: HoursPoint[];
  subjects: SubjectPoint[];
  mood: MoodPoint[];
}) {
  const [tab, setTab] = useState<Tab>("scores");

  const kpis = useMemo(() => {
    const scoreVals = scores.map((s) => s.scorePct);
    const avgScore = avg(scoreVals);
    const bestScore = scoreVals.length ? Math.max(...scoreVals) : 0;
    const avgDiscipline = avg(discipline.map((d) => d.discipline));
    const totalHours = hours.reduce((sum, h) => sum + h.hours, 0);
    return [
      { label: "Avg score", value: `${avgScore.toFixed(1)}%`, hint: `${scores.length} tests logged`, icon: Gauge, tone: C.gold, spark: scoreVals },
      { label: "Best score", value: `${bestScore.toFixed(1)}%`, hint: "peak performance", icon: Award, tone: C.physics, spark: scoreVals },
      { label: "Avg discipline", value: `${avgDiscipline.toFixed(0)}/100`, hint: `${discipline.length} day logs`, icon: LineIcon, tone: C.botany, spark: discipline.map((d) => d.discipline) },
      { label: "Total hours", value: `${totalHours.toFixed(0)}h`, hint: `${hours.length} sessions`, icon: Clock, tone: C.lotus, spark: hours.map((h) => h.hours) },
    ];
  }, [scores, discipline, hours]);

  const avgScoreLine = useMemo(() => avg(scores.map((s) => s.scorePct)), [scores]);
  const topSubjectHours = useMemo(() => (subjects.length ? Math.max(...subjects.map((s) => s.hours)) : 0), [subjects]);

  return (
    <div className="section-stack" style={{ marginTop: 0 }}>
      {/* KPI strip */}
      <div className="perf-kpi-grid">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="perf-kpi" style={{ color: kpi.tone }}>
            <div className="perf-kpi-head">
              <div className="perf-kpi-ico"><kpi.icon size={17} /></div>
              <div className="perf-kpi-label">{kpi.label}</div>
            </div>
            <div className="perf-kpi-value">{kpi.value}</div>
            <div className="perf-kpi-hint">{kpi.hint}</div>
            <div className="perf-kpi-spark">
              <ResponsiveContainer>
                <AreaChart data={kpi.spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`spark-${kpi.label.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={kpi.tone} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={kpi.tone} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={kpi.tone} strokeWidth={2} fill={`url(#spark-${kpi.label.replace(/\s/g, "")})`} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>
        ))}
      </div>

      {/* Segmented analytics console */}
      <article className="glass panel perf-panel span-full">
        <div className="perf-panel-head">
          <div>
            <div className="eyebrow">Analytics console</div>
            <div className="perf-panel-title">One signal at a time — no clutter.</div>
            <div className="perf-panel-sub">Switch lanes to read each dimension of your preparation in isolation.</div>
          </div>
          <div className="perf-seg">
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)} type="button">
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* SCORES */}
        {tab === "scores" && (
          <>
            <div className="perf-legend">
              <span style={{ "--series-color": C.gold } as CSSProperties}><i />Score %</span>
              <span style={{ "--series-color": "rgba(238,232,217,0.5)" } as CSSProperties}><i style={{ background: "rgba(238,232,217,0.5)" }} />Average ({avgScoreLine.toFixed(1)}%)</span>
            </div>
            <Frame tone={C.gold}>
              <AreaChart data={scores.length ? scores : [{ label: "No data", scorePct: 0, score: 0, totalMarks: 0 }]} margin={{ top: 16, right: 16, bottom: 4, left: -6 }}>
                <defs>
                  <linearGradient id="perf-score" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.gold} stopOpacity={0.42} />
                    <stop offset="78%" stopColor={C.gold} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" {...AXIS} minTickGap={20} />
                <YAxis domain={[0, 100]} {...AXIS} width={40} tickFormatter={(v) => `${v}%`} />
                <ReferenceLine y={avgScoreLine} stroke="rgba(238,232,217,0.4)" strokeDasharray="5 6" />
                <Tooltip content={(p) => <GenericTooltip {...p} rows={[{ key: "scorePct", label: "Score", color: C.gold, suffix: "%" }, { key: "score", label: "Marks", color: C.physics }]} />} cursor={{ stroke: "rgba(255,255,255,0.14)" }} />
                <Area type="monotone" dataKey="scorePct" stroke={C.gold} strokeWidth={3.2} fill="url(#perf-score)" dot={{ r: 2.5, fill: C.gold, strokeWidth: 0 }} activeDot={{ r: 5.5, stroke: "rgba(5,7,14,0.9)", strokeWidth: 2 }} strokeLinecap="round" animationDuration={900} animationEasing="ease-out" />
              </AreaChart>
            </Frame>
          </>
        )}

        {/* STUDY HOURS */}
        {tab === "hours" && (
          <>
            <div className="perf-legend">
              <span style={{ "--series-color": C.lotus } as CSSProperties}><i />Hours / session</span>
            </div>
            <Frame tone={C.lotus}>
              <BarChart data={hours.length ? hours : [{ label: "No data", hours: 0 }]} margin={{ top: 16, right: 16, bottom: 4, left: -6 }}>
                <defs>
                  <linearGradient id="perf-hours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.lotus} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={C.physics} stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" {...AXIS} minTickGap={14} />
                <YAxis {...AXIS} width={32} domain={[0, "auto"]} />
                <ReferenceLine y={8} stroke="rgba(101,240,181,0.5)" strokeDasharray="4 6" />
                <Tooltip content={(p) => <GenericTooltip {...p} rows={[{ key: "hours", label: "Hours", color: C.lotus, suffix: "h" }]} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="hours" fill="url(#perf-hours)" radius={[8, 8, 3, 3]} maxBarSize={26} animationDuration={760} />
              </BarChart>
            </Frame>
          </>
        )}

        {/* DISCIPLINE */}
        {tab === "discipline" && (
          <>
            <div className="perf-legend">
              <span style={{ "--series-color": C.botany } as CSSProperties}><i />Discipline /100</span>
              <span style={{ "--series-color": C.gold } as CSSProperties}><i />Completion %</span>
            </div>
            <Frame tone={C.botany}>
              <ComposedChart data={discipline.length ? discipline : [{ label: "No data", discipline: 0, completion: 0 }]} margin={{ top: 16, right: 16, bottom: 4, left: -6 }}>
                <defs>
                  <linearGradient id="perf-disc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.botany} stopOpacity={0.34} />
                    <stop offset="80%" stopColor={C.botany} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" {...AXIS} minTickGap={20} />
                <YAxis domain={[0, 100]} {...AXIS} width={32} />
                <Tooltip content={(p) => <GenericTooltip {...p} rows={[{ key: "discipline", label: "Discipline", color: C.botany }, { key: "completion", label: "Completion", color: C.gold, suffix: "%" }]} />} cursor={{ stroke: "rgba(255,255,255,0.14)" }} />
                <Area type="monotone" dataKey="discipline" stroke={C.botany} strokeWidth={3} fill="url(#perf-disc)" dot={false} activeDot={{ r: 5 }} strokeLinecap="round" animationDuration={880} />
                <Line type="monotone" dataKey="completion" stroke={C.gold} strokeWidth={2.4} dot={false} strokeLinecap="round" animationDuration={1040} />
              </ComposedChart>
            </Frame>
          </>
        )}

        {/* SUBJECTS */}
        {tab === "subjects" && (
          <>
            <div className="perf-legend">
              <span style={{ "--series-color": C.physics } as CSSProperties}><i />Hours by subject</span>
            </div>
            <Frame tone={C.physics}>
              <BarChart layout="vertical" data={(subjects.length ? subjects : [{ subject: "No data", hours: 0, sessions: 0 }]).slice(0, 10)} margin={{ top: 8, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" {...AXIS} />
                <YAxis type="category" dataKey="subject" {...AXIS} width={120} tick={{ fontSize: 11, fontWeight: 700, fill: "rgba(238,232,217,0.78)" }} />
                <Tooltip content={(p) => <GenericTooltip {...p} rows={[{ key: "hours", label: "Hours", color: C.physics, suffix: "h" }, { key: "sessions", label: "Sessions", color: C.gold }]} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="hours" radius={[3, 8, 8, 3]} maxBarSize={22} animationDuration={760}>
                  {(subjects.length ? subjects : [{ subject: "No data", hours: 0, sessions: 0 }]).slice(0, 10).map((s) => (
                    <Cell key={s.subject} fill={`color-mix(in srgb, ${C.physics} ${Math.round(40 + (topSubjectHours ? (s.hours / topSubjectHours) * 55 : 0))}%, ${C.lotus})`} />
                  ))}
                </Bar>
              </BarChart>
            </Frame>
          </>
        )}

        {/* MOOD */}
        {tab === "mood" && (
          <>
            <div className="perf-legend">
              <span style={{ "--series-color": C.physics } as CSSProperties}><i />Focus /10</span>
              <span style={{ "--series-color": C.rose } as CSSProperties}><i />Stress /10</span>
            </div>
            <Frame tone={C.physics}>
              <ComposedChart data={mood.length ? mood : [{ label: "No data", focus: 0, stress: 0 }]} margin={{ top: 16, right: 16, bottom: 4, left: -10 }}>
                <defs>
                  <linearGradient id="perf-focus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.physics} stopOpacity={0.3} />
                    <stop offset="82%" stopColor={C.physics} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" {...AXIS} minTickGap={20} />
                <YAxis domain={[0, 10]} {...AXIS} width={26} />
                <Tooltip content={(p) => <GenericTooltip {...p} rows={[{ key: "focus", label: "Focus", color: C.physics, suffix: "/10" }, { key: "stress", label: "Stress", color: C.rose, suffix: "/10" }]} />} cursor={{ stroke: "rgba(255,255,255,0.14)" }} />
                <Area type="monotone" dataKey="focus" stroke={C.physics} strokeWidth={3} fill="url(#perf-focus)" dot={false} activeDot={{ r: 5 }} strokeLinecap="round" animationDuration={880} />
                <Line type="monotone" dataKey="stress" stroke={C.rose} strokeWidth={2.4} dot={false} strokeLinecap="round" animationDuration={1040} />
              </ComposedChart>
            </Frame>
          </>
        )}
      </article>
    </div>
  );
}
