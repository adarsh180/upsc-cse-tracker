"use client";

import { useMemo, useRef, useEffect } from "react";
import { format, subDays, startOfDay, differenceInDays } from "date-fns";

type HeatmapData = {
  date: string; // yyyy-MM-dd
  hours: number;
  completion: number;
};

export function ActivityHeatmap({ data }: { data: HeatmapData[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate the last 550 days mapped to weeks
  const { weeks, maxHours } = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    let maxHr = 1;
    data.forEach((d) => {
      map.set(d.date, d);
      if (d.hours > maxHr) maxHr = d.hours;
    });

    const daysCount = 550;
    const today = startOfDay(new Date());

    // Calculate the start date (550 days ago) and shift to the nearest Sunday
    const startDate = subDays(today, daysCount);
    const startDayOfWeek = startDate.getDay();
    const gridStart = subDays(startDate, startDayOfWeek);

    const totalDays = differenceInDays(today, gridStart) + 1;
    const weeksArr: {
      date: Date;
      intensity: number;
      isFuture: boolean;
      data: HeatmapData | null;
    }[][] = [];

    let currentWeek: any[] = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = subDays(gridStart, -i);
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const log = map.get(dateStr) || null;

      let intensity = 0;
      if (log) {
        // Base intensity mostly on hours to match LeetCode deep-work tracking
        const ratio = log.hours / 6; // Anything above 6 hours is intense
        if (ratio > 0.8) intensity = 4;
        else if (ratio > 0.5) intensity = 3;
        else if (ratio > 0.2) intensity = 2;
        else if (ratio > 0) intensity = 1;
      }

      currentWeek.push({
        date: currentDate,
        intensity,
        isFuture: currentDate > today,
        data: log,
      });

      if (currentWeek.length === 7) {
        weeksArr.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ isFuture: true, intensity: 0, date: new Date() });
      }
      weeksArr.push(currentWeek);
    }

    return { weeks: weeksArr, maxHours: maxHr };
  }, [data]);

  // Scroll to extreme right on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, []);

  const getIntensityColor = (intensity: number) => {
    if (intensity === 4) return "var(--botany)";
    if (intensity === 3) return "rgba(101, 240, 181, 0.75)";
    if (intensity === 2) return "rgba(101, 240, 181, 0.45)";
    if (intensity === 1) return "rgba(101, 240, 181, 0.2)";
    return "rgba(255, 255, 255, 0.05)";
  };

  return (
    <article className="glass panel" style={{ overflow: "hidden", padding: "24px" }}>
      <div className="eyebrow" style={{ marginBottom: 18 }}>
        Execution Heatmap (550 days)
      </div>
      <div
        ref={scrollRef}
        style={{
          width: "100%",
          overflowX: "auto",
          display: "flex",
          gap: 4,
          paddingBottom: 4,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="hide-scrollbar"
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        {weeks.map((week, wIdx) => (
          <div key={wIdx} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {week.map((day, dIdx) => (
              <div
                key={dIdx}
                title={
                  day.isFuture
                    ? ""
                    : `${format(day.date, "MMM dd, yyyy")}: ${day.data ? day.data.hours.toFixed(1) + "h" : "0h"}`
                }
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3.5,
                  background: day.isFuture ? "transparent" : getIntensityColor(day.intensity),
                  cursor: day.isFuture ? "default" : "pointer",
                  transition: "transform 0.1s ease, box-shadow 0.1s ease",
                  border: day.isFuture
                    ? "none"
                    : day.intensity === 0
                    ? "1px solid rgba(255,255,255,0.03)"
                    : "1px solid rgba(0,0,0,0.1)",
                }}
                onMouseEnter={(e) => {
                  if (!day.isFuture) {
                    e.currentTarget.style.transform = "scale(1.3)";
                    e.currentTarget.style.boxShadow = "0 0 10px rgba(101, 240, 181, 0.5)";
                    e.currentTarget.style.zIndex = "10";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!day.isFuture) {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.zIndex = "1";
                  }
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
          marginTop: 12,
          fontSize: "11px",
          color: "var(--text-muted)",
          fontWeight: 600,
        }}
      >
        Less
        <div style={{ width: 11, height: 11, borderRadius: 3, background: getIntensityColor(0) }} />
        <div style={{ width: 11, height: 11, borderRadius: 3, background: getIntensityColor(1) }} />
        <div style={{ width: 11, height: 11, borderRadius: 3, background: getIntensityColor(2) }} />
        <div style={{ width: 11, height: 11, borderRadius: 3, background: getIntensityColor(3) }} />
        <div style={{ width: 11, height: 11, borderRadius: 3, background: getIntensityColor(4) }} />
        Intense
      </div>
    </article>
  );
}
