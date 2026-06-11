"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartGrid = "var(--chart-grid)";
const chartAxis = "var(--chart-axis)";
const chartTooltipBg = "var(--chart-tooltip-bg)";
const chartTooltipBorder = "var(--chart-tooltip-border)";
const chartTooltipText = "var(--chart-tooltip-text)";

export type WeeklyTrendPoint = {
  label: string;
  hours: number;
  integrity: number | null;
  vivaAccuracy: number | null;
  discipline: number | null;
};

export type CaTrendPoint = {
  label: string;
  attempted: number;
  accuracyPct: number;
};

const tooltipStyle = {
  background: chartTooltipBg,
  border: `1px solid ${chartTooltipBorder}`,
  borderRadius: 10,
  fontSize: 12,
  color: chartTooltipText,
};

export function ProgressTrends({ weekly, caDaily }: { weekly: WeeklyTrendPoint[]; caDaily: CaTrendPoint[] }) {
  if (weekly.length === 0 && caDaily.length === 0) {
    return (
      <article className="glass" style={{ padding: "18px 20px", borderRadius: 16 }}>
        <p style={{ fontSize: 13, opacity: 0.75 }}>
          Trend graphs appear here once a few weekly report cards and current-affairs quiz attempts have accumulated.
        </p>
      </article>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {weekly.length > 0 ? (
        <article className="glass" style={{ padding: "18px 20px 8px", borderRadius: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Week by week: hours vs honesty vs viva
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={weekly} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartAxis }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="hours" tick={{ fontSize: 11, fill: chartAxis }} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="pct"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: chartAxis }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="hours" dataKey="hours" name="Study hours" fill="var(--gold, #d4af37)" radius={[5, 5, 0, 0]} barSize={22} opacity={0.85} />
              <Line yAxisId="pct" type="monotone" dataKey="integrity" name="Integrity score" stroke="#4ade80" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="pct" type="monotone" dataKey="vivaAccuracy" name="Viva accuracy %" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </article>
      ) : null}

      {caDaily.length > 0 ? (
        <article className="glass" style={{ padding: "18px 20px 8px", borderRadius: 16 }}>
          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Current-affairs self-check accuracy (last 30 days)
          </p>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={caDaily} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={chartGrid} strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: chartAxis }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: chartAxis }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="accuracyPct" name="Accuracy %" fill="var(--lotus-bright, #e879a0)" radius={[5, 5, 0, 0]} barSize={16} opacity={0.85} />
              <Line type="monotone" dataKey="attempted" name="Questions attempted" stroke="#facc15" strokeWidth={2} dot={{ r: 2.5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </article>
      ) : null}
    </div>
  );
}
