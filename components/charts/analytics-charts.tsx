"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";

type ChartPoint = {
  label: string;
  value: number;
  secondary?: number;
};

export function TrendChart({
  data,
  color = "#54d2ff",
  secondaryColor = "#65f0b5",
  tertiaryColor = "#f5d061",
  secondaryKey,
  tertiaryKey,
}: {
  data: any[];
  color?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
  secondaryKey?: string;
  tertiaryKey?: string;
}) {
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="label" stroke="#7d8ebd" tickLine={false} axisLine={false} />
          <YAxis stroke="#7d8ebd" tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "rgba(12, 18, 32, 0.92)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
            }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} dot={false} />
          {secondaryKey ? (
            <Line
              type="monotone"
              dataKey={secondaryKey}
              stroke={secondaryColor}
              strokeWidth={2}
              dot={false}
            />
          ) : null}
          {tertiaryKey ? (
            <Line
              type="monotone"
              dataKey={tertiaryKey}
              stroke={tertiaryColor}
              strokeWidth={2}
              dot={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaTrendChart({
  data,
  color = "#5ea1ff",
}: {
  data: ChartPoint[];
  color?: string;
}) {
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="metric-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.45} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="label" stroke="#7d8ebd" tickLine={false} axisLine={false} />
          <YAxis stroke="#7d8ebd" tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: "rgba(12, 18, 32, 0.92)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#metric-gradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
