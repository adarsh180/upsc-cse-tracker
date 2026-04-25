"use client";

import { useMemo, type CSSProperties } from "react";

type HeatmapData = {
  date: string; // yyyy-MM-dd
  hours: number;
  completion: number;
};

type HeatmapDay = {
  dateKey: string;
  displayDate: string;
  monthLabel: string;
  intensity: number;
  isFuture: boolean;
  data: HeatmapData | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_TIME_ZONE = "Asia/Kolkata";
const RANGE_START = "2026-04-01";
const DEFAULT_RANGE_DAYS = 550;

function keyToUtcDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateToKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";

  return `${year}-${month}-${day}`;
}

function addDaysToKey(dateKey: string, days: number) {
  const next = new Date(keyToUtcDate(dateKey).getTime() + days * DAY_MS);
  return next.toISOString().slice(0, 10);
}

function differenceInDateKeys(later: string, earlier: string) {
  return Math.round((keyToUtcDate(later).getTime() - keyToUtcDate(earlier).getTime()) / DAY_MS);
}

function laterDateKey(a: string, b: string) {
  return a > b ? a : b;
}

function formatDateKey(dateKey: string, format: "short" | "month" | "range") {
  const date = keyToUtcDate(dateKey);
  const options =
    format === "month"
      ? { month: "short" as const }
      : format === "range"
        ? { day: "2-digit" as const, month: "short" as const, year: "numeric" as const }
        : { day: "2-digit" as const, month: "short" as const };

  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(date);
}

export function ActivityHeatmap({
  data,
  startDate = RANGE_START,
  endDate,
}: {
  data: HeatmapData[];
  startDate?: string;
  endDate?: string;
}) {
  const todayKey = dateToKey(new Date());

  const { weeks, totals } = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    let totalHours = 0;
    let activeDays = 0;
    let bestHours = 0;

    data.forEach((d) => {
      map.set(d.date, d);
      if (d.hours > 0) activeDays += 1;
      totalHours += d.hours;
      bestHours = Math.max(bestHours, d.hours);
    });

    const safeStart = startDate || RANGE_START;
    const fixedRangeEnd = addDaysToKey(safeStart, DEFAULT_RANGE_DAYS - 1);
    const requestedEnd = endDate && endDate > fixedRangeEnd ? endDate : fixedRangeEnd;
    const safeEnd = laterDateKey(requestedEnd, todayKey);
    const totalDays = Math.max(1, differenceInDateKeys(safeEnd, safeStart) + 1);
    const weeksArr: HeatmapDay[][] = [];
    let currentWeek: HeatmapDay[] = [];

    for (let i = 0; i < totalDays; i++) {
      const dateKey = addDaysToKey(safeStart, i);
      const log = map.get(dateKey) || null;
      let intensity = 0;

      if (log) {
        const ratio = Math.max(log.hours / 6, log.completion / 120);
        if (ratio > 0.8) intensity = 4;
        else if (ratio > 0.5) intensity = 3;
        else if (ratio > 0.2) intensity = 2;
        else if (ratio > 0) intensity = 1;
      }

      currentWeek.push({
        dateKey,
        displayDate: formatDateKey(dateKey, "short"),
        monthLabel: formatDateKey(dateKey, "month"),
        intensity,
        isFuture: dateKey > todayKey,
        data: log,
      });

      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        const dateKey = addDaysToKey(safeStart, totalDays + currentWeek.length);
        currentWeek.push({
          dateKey,
          displayDate: formatDateKey(dateKey, "short"),
          monthLabel: "",
          isFuture: true,
          intensity: 0,
          data: null,
        });
      }
      weeksArr.push(currentWeek);
    }

    return {
      weeks: weeksArr,
      totals: {
        activeDays,
        totalHours: Number(totalHours.toFixed(1)),
        bestHours,
        start: safeStart,
        end: safeEnd,
      },
    };
  }, [data, endDate, startDate, todayKey]);

  const getIntensityColor = (intensity: number) => {
    if (intensity === 4) return "var(--botany)";
    if (intensity === 3) return "rgba(101, 240, 181, 0.75)";
    if (intensity === 2) return "rgba(101, 240, 181, 0.45)";
    if (intensity === 1) return "rgba(101, 240, 181, 0.2)";
    return "rgba(255, 255, 255, 0.05)";
  };

  return (
    <article className="glass panel heatmap-panel">
      <div className="heatmap-head">
        <div>
          <div className="eyebrow">Execution Heatmap</div>
          <div className="display heatmap-title">IST execution field</div>
          <div className="heatmap-range">
            {formatDateKey(totals.start, "range")} to {formatDateKey(totals.end, "range")}
          </div>
        </div>
        <div className="heatmap-stats">
          <span><strong>{totals.activeDays}</strong> active days</span>
          <span><strong>{totals.totalHours}h</strong> logged</span>
          <span><strong>{totals.bestHours.toFixed(1)}h</strong> best day</span>
        </div>
      </div>
      <div className="heatmap-scroll hide-scrollbar">
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        {weeks.map((week, wIdx) => (
          <div key={week[0]?.dateKey ?? wIdx} className="heatmap-week">
            <div className="heatmap-month">
              {week.some((day) => day.dateKey.endsWith("-01"))
                ? week.find((day) => day.dateKey.endsWith("-01"))?.monthLabel
                : ""}
            </div>
            {week.map((day, dIdx) => (
              <button
                key={`${day.dateKey}-${dIdx}`}
                type="button"
                className={`heatmap-cell${day.isFuture ? " future" : ""}`}
                title={
                  day.isFuture
                    ? `${day.displayDate}: planned day`
                    : `${day.displayDate}: ${
                        day.data ? `${day.data.hours.toFixed(1)}h, ${day.data.completion}% done` : "0h"
                      }`
                }
                style={{
                  "--heat-color": getIntensityColor(day.intensity),
                  background: day.isFuture ? "rgba(255,255,255,0.025)" : getIntensityColor(day.intensity),
                  border: day.intensity === 0
                    ? "1px solid rgba(255,255,255,0.03)"
                    : "1px solid rgba(0,0,0,0.1)",
                } as CSSProperties}
                aria-label={
                  day.isFuture
                    ? `${day.displayDate}: future day`
                    : `${day.displayDate}: ${day.data ? `${day.data.hours.toFixed(1)} hours` : "No hours"}`
                }
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        Less
        {[0, 1, 2, 3, 4].map((intensity) => (
          <span key={intensity} style={{ background: getIntensityColor(intensity) }} />
        ))}
        Intense
        <span className="heatmap-future-key" />
        Planned
      </div>
    </article>
  );
}
