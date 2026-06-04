"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Momentum Heatmap — an emoji-tier "grind ladder" replacement for the old
 * GitHub-style colour grid. Intensity is rigorous and hours-driven:
 *   < 4h  drift · 4–6h warming · 6–8h close · 8–10h GOOD · 10–12h strong · 12h+ PEAK.
 * Only 8h+ counts as a genuinely good day; 12h+ is the peak target.
 *
 * The field is split into 500-day blocks. A new block is created automatically
 * once the timeline crosses each 500-day boundary; blocks are navigable.
 */

type HeatmapData = {
  date: string; // yyyy-MM-dd
  hours: number;
  completion: number;
};

type MomentumDay = {
  dateKey: string;
  displayDate: string;
  monthLabel: string;
  tier: number;
  isFuture: boolean;
  isToday: boolean;
  isPad: boolean;
  data: HeatmapData | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_TIME_ZONE = "Asia/Kolkata";
const RANGE_START = "2026-04-01";
const BLOCK_SIZE = 500;

export type MomentumTier = {
  tier: number;
  emoji: string;
  label: string;
  min: number;
  accent: string;
  glow: string;
};

export const MOMENTUM_TIERS: MomentumTier[] = [
  { tier: 0, emoji: "·", label: "Rest", min: 0, accent: "rgba(255,255,255,0.18)", glow: "transparent" },
  { tier: 1, emoji: "🌱", label: "Drift", min: 0.01, accent: "hsl(210, 22%, 58%)", glow: "hsla(210,40%,60%,0.30)" },
  { tier: 2, emoji: "📖", label: "Warming", min: 4, accent: "hsl(199, 78%, 60%)", glow: "hsla(199,80%,58%,0.34)" },
  { tier: 3, emoji: "🔥", label: "Close", min: 6, accent: "hsl(28, 92%, 60%)", glow: "hsla(28,92%,58%,0.40)" },
  { tier: 4, emoji: "💪", label: "Good", min: 8, accent: "hsl(148, 62%, 52%)", glow: "hsla(148,70%,52%,0.46)" },
  { tier: 5, emoji: "🏆", label: "Strong", min: 10, accent: "hsl(168, 70%, 54%)", glow: "hsla(168,76%,52%,0.50)" },
  { tier: 6, emoji: "🚀", label: "Peak", min: 12, accent: "hsl(38, 96%, 60%)", glow: "hsla(38,96%,58%,0.62)" },
];

export function tierForHours(hours: number): number {
  if (hours <= 0) return 0;
  if (hours < 4) return 1;
  if (hours < 6) return 2;
  if (hours < 8) return 3;
  if (hours < 10) return 4;
  if (hours < 12) return 5;
  return 6;
}

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
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  return `${year}-${month}-${day}`;
}

function addDaysToKey(dateKey: string, days: number) {
  return new Date(keyToUtcDate(dateKey).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function diffDays(later: string, earlier: string) {
  return Math.round((keyToUtcDate(later).getTime() - keyToUtcDate(earlier).getTime()) / DAY_MS);
}

function formatKey(dateKey: string, format: "short" | "month" | "range") {
  const date = keyToUtcDate(dateKey);
  const options =
    format === "month"
      ? { month: "short" as const }
      : format === "range"
        ? { day: "2-digit" as const, month: "short" as const, year: "2-digit" as const }
        : { day: "2-digit" as const, month: "short" as const };
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(date);
}

function weekdayMonFirst(dateKey: string) {
  const js = keyToUtcDate(dateKey).getUTCDay();
  return (js + 6) % 7;
}

export function MomentumHeatmap({
  data,
  startDate = RANGE_START,
}: {
  data: HeatmapData[];
  startDate?: string;
}) {
  const todayKey = dateToKey(new Date());
  const globalStart = startDate || RANGE_START;

  const daysSinceStart = Math.max(0, diffDays(todayKey, globalStart));
  const currentBlock = Math.floor(daysSinceStart / BLOCK_SIZE);
  const blockCount = currentBlock + 1;

  const [activeBlock, setActiveBlock] = useState(currentBlock);
  const [active, setActive] = useState<MomentumDay | null>(null);

  // Global stats — drawn from every logged day, independent of the visible block.
  const stats = useMemo(() => {
    let totalHours = 0;
    let activeDays = 0;
    let goodDays = 0;
    let peakDays = 0;
    let bestHours = 0;
    const map = new Map<string, HeatmapData>();
    data.forEach((d) => {
      map.set(d.date, d);
      if (d.hours > 0) activeDays += 1;
      if (d.hours >= 8) goodDays += 1;
      if (d.hours >= 12) peakDays += 1;
      totalHours += d.hours;
      bestHours = Math.max(bestHours, d.hours);
    });

    let streak = 0;
    for (let i = 0; ; i++) {
      const k = addDaysToKey(todayKey, -i);
      if (k < globalStart) break;
      const log = map.get(k);
      if (log && log.hours > 0) streak += 1;
      else if (i === 0) continue;
      else break;
    }

    return {
      activeDays,
      goodDays,
      peakDays,
      streak,
      totalHours: Number(totalHours.toFixed(1)),
      bestHours: Number(bestHours.toFixed(1)),
    };
  }, [data, globalStart, todayKey]);

  // Weeks for the currently selected 500-day block.
  const { weeks, blockStart, blockEnd, blockProgress, blockElapsed } = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    data.forEach((d) => map.set(d.date, d));

    const bStart = addDaysToKey(globalStart, activeBlock * BLOCK_SIZE);
    const bEnd = addDaysToKey(bStart, BLOCK_SIZE - 1);
    const leadPad = weekdayMonFirst(bStart);

    const days: MomentumDay[] = [];
    for (let i = -leadPad; i < BLOCK_SIZE; i++) {
      const dateKey = addDaysToKey(bStart, i);
      const isPad = i < 0;
      const log = isPad ? null : map.get(dateKey) ?? null;
      days.push({
        dateKey,
        displayDate: formatKey(dateKey, "short"),
        monthLabel: formatKey(dateKey, "month"),
        tier: log ? tierForHours(log.hours) : 0,
        isFuture: dateKey > todayKey || isPad,
        isToday: dateKey === todayKey,
        isPad,
        data: log,
      });
    }
    // Pad the tail to a full final week.
    while (days.length % 7 !== 0) {
      const dateKey = addDaysToKey(bStart, days.length - leadPad);
      days.push({
        dateKey,
        displayDate: formatKey(dateKey, "short"),
        monthLabel: "",
        tier: 0,
        isFuture: true,
        isToday: false,
        isPad: true,
        data: null,
      });
    }

    const weeksArr: MomentumDay[][] = [];
    for (let i = 0; i < days.length; i += 7) weeksArr.push(days.slice(i, i + 7));

    const elapsed =
      activeBlock < currentBlock
        ? BLOCK_SIZE
        : activeBlock > currentBlock
          ? 0
          : Math.min(BLOCK_SIZE, daysSinceStart - activeBlock * BLOCK_SIZE + 1);

    return {
      weeks: weeksArr,
      blockStart: bStart,
      blockEnd: bEnd,
      blockProgress: Math.round((elapsed / BLOCK_SIZE) * 100),
      blockElapsed: elapsed,
    };
  }, [data, globalStart, activeBlock, currentBlock, daysSinceStart, todayKey]);

  return (
    <article className="glass panel momentum-panel">
      <div className="momentum-head">
        <div>
          <div className="eyebrow">Momentum field</div>
          <div className="display momentum-title">The grind ladder</div>
          <div className="momentum-sub">8h+ is a good day · 12h+ is peak · 500-day blocks</div>
        </div>
        <div className="momentum-stat-cluster">
          <div className="momentum-stat" data-tone="streak">
            <strong>{stats.streak}</strong>
            <span>day streak</span>
          </div>
          <div className="momentum-stat" data-tone="good">
            <strong>{stats.goodDays}</strong>
            <span>good days</span>
          </div>
          <div className="momentum-stat" data-tone="peak">
            <strong>{stats.peakDays}</strong>
            <span>peak days</span>
          </div>
          <div className="momentum-stat">
            <strong>{stats.bestHours}h</strong>
            <span>best day</span>
          </div>
        </div>
      </div>

      <div className="momentum-block-bar">
        <div className="momentum-block-nav">
          <button
            type="button"
            className="momentum-block-btn"
            onClick={() => setActiveBlock((b) => Math.max(0, b - 1))}
            disabled={activeBlock === 0}
            aria-label="Previous block"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="momentum-block-meta">
            <strong>Block {activeBlock + 1}<span className="momentum-block-total"> / {blockCount}</span></strong>
            <span>{formatKey(blockStart, "range")} – {formatKey(blockEnd, "range")}</span>
          </div>
          <button
            type="button"
            className="momentum-block-btn"
            onClick={() => setActiveBlock((b) => Math.min(blockCount - 1, b + 1))}
            disabled={activeBlock >= blockCount - 1}
            aria-label="Next block"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="momentum-block-progress">
          <div className="momentum-block-progress-track">
            <span style={{ width: `${blockProgress}%` }} />
          </div>
          <span className="momentum-block-progress-label">Day {blockElapsed} / {BLOCK_SIZE}</span>
        </div>
      </div>

      <div className="momentum-grid-wrap">
        <div className="momentum-weekday-rail" aria-hidden="true">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="momentum-scroll hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar{display:none;}`}</style>
          <div className="momentum-months">
            {weeks.map((week, wIdx) => {
              const firstOfMonth = week.find((d) => d.dateKey.endsWith("-01") && !d.isPad);
              return (
                <span key={week[0]?.dateKey ?? wIdx} className="momentum-month-tag">
                  {firstOfMonth ? firstOfMonth.monthLabel : ""}
                </span>
              );
            })}
          </div>
          <div className="momentum-grid">
            {weeks.map((week, wIdx) => (
              <div key={week[0]?.dateKey ?? wIdx} className="momentum-week">
                {week.map((day) => {
                  const t = MOMENTUM_TIERS[day.tier];
                  if (day.isFuture) {
                    return <div key={day.dateKey} className="momentum-cell future" aria-hidden="true" />;
                  }
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      className={`momentum-cell tier-${day.tier}${day.isToday ? " is-today" : ""}${
                        day.tier >= 4 ? " is-good" : ""
                      }`}
                      style={
                        {
                          "--cell-accent": t.accent,
                          "--cell-glow": t.glow,
                        } as CSSProperties
                      }
                      onMouseEnter={() => setActive(day)}
                      onFocus={() => setActive(day)}
                      onMouseLeave={() => setActive((cur) => (cur?.dateKey === day.dateKey ? null : cur))}
                      title={`${day.displayDate}: ${
                        day.data ? `${day.data.hours.toFixed(1)}h · ${day.data.completion}% done — ${t.label}` : "no log"
                      }`}
                      aria-label={`${day.displayDate}: ${day.data ? `${day.data.hours.toFixed(1)} hours, ${t.label}` : "no log"}`}
                    >
                      <span className="momentum-emoji">{t.emoji}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="momentum-footer">
        <div className="momentum-readout">
          {active && active.data ? (
            <>
              <span className="momentum-readout-emoji">{MOMENTUM_TIERS[active.tier].emoji}</span>
              <div>
                <strong>{active.displayDate}</strong>
                <span>
                  {active.data.hours.toFixed(1)}h · {active.data.completion}% done ·{" "}
                  <b style={{ color: MOMENTUM_TIERS[active.tier].accent }}>{MOMENTUM_TIERS[active.tier].label}</b>
                </span>
              </div>
            </>
          ) : (
            <span className="momentum-readout-hint">Hover a day to read it · {stats.totalHours}h logged across {stats.activeDays} days</span>
          )}
        </div>
        <div className="momentum-legend">
          {MOMENTUM_TIERS.slice(1).map((t) => (
            <span key={t.tier} className="momentum-legend-item" title={`${t.label} — ${t.min}h+`}>
              <i style={{ "--cell-accent": t.accent } as CSSProperties}>{t.emoji}</i>
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
