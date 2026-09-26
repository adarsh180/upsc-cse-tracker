"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Momentum Heatmap — a dot-matrix field: each day is a dot whose size grows
 * with hours and whose colour is its tier, with weekly totals underneath.
 * Intensity is rigorous and hours-driven:
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

import { MOMENTUM_TIERS, tierForHours, type MomentumTier } from "@/components/goals/momentum-tiers";

export { MOMENTUM_TIERS, tierForHours, type MomentumTier };

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
  const [hovered, setHovered] = useState<MomentumDay | null>(null);
  const [pinned, setPinned] = useState<MomentumDay | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
      avg: activeDays ? Number((totalHours / activeDays).toFixed(1)) : 0,
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

  // Keep "today" in view: the block is ~72 weeks wide, today is usually at the far edge.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const today = box.querySelector<HTMLElement>(".mh-cell.is-today");
    const target = today ? today.offsetLeft - box.clientWidth * 0.7 : 0;
    box.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }, [activeBlock]);

  const shown = pinned ?? hovered;
  const shownTier = shown ? MOMENTUM_TIERS[shown.tier] : null;

  // Weekly totals under the grid — one bar per column, coloured by the week's
  // average logged day so a strong week reads at a glance.
  const weekBars = useMemo(() => {
    const rows = weeks.map((week) => {
      const days = week.filter((d) => !d.isFuture);
      const total = days.reduce((sum, d) => sum + (d.data?.hours ?? 0), 0);
      const logged = days.filter((d) => (d.data?.hours ?? 0) > 0).length;
      return { key: week[0]?.dateKey ?? "", total, avgTier: logged ? tierForHours(total / logged) : 0, future: days.length === 0 };
    });
    const max = Math.max(1, ...rows.map((r) => r.total));
    return rows.map((r) => ({ ...r, h: r.total / max }));
  }, [weeks]);

  return (
    <article className="mh">
      <header className="mh-head">
        <dl className="mh-stats">
          <div className="is-streak">
            <dt>Streak</dt>
            <dd>
              {stats.streak}
              <small>d</small>
            </dd>
          </div>
          <div className="is-good">
            <dt>8h+ days</dt>
            <dd>{stats.goodDays}</dd>
          </div>
          <div className="is-peak">
            <dt>12h+ days</dt>
            <dd>{stats.peakDays}</dd>
          </div>
          <div>
            <dt>Best day</dt>
            <dd>
              {stats.bestHours}
              <small>h</small>
            </dd>
          </div>
          <div>
            <dt>Avg active</dt>
            <dd>
              {stats.avg}
              <small>h</small>
            </dd>
          </div>
          <div>
            <dt>Logged</dt>
            <dd>
              {stats.totalHours}
              <small>h</small>
            </dd>
          </div>
        </dl>

        <div className="mh-block">
          <button
            type="button"
            className="mh-block-btn"
            onClick={() => setActiveBlock((b) => Math.max(0, b - 1))}
            disabled={activeBlock === 0}
            aria-label="Previous 500-day block"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="mh-block-meta">
            <strong>
              Block {activeBlock + 1}
              <span> / {blockCount}</span>
            </strong>
            <small>
              {formatKey(blockStart, "range")} – {formatKey(blockEnd, "range")}
            </small>
          </div>
          <button
            type="button"
            className="mh-block-btn"
            onClick={() => setActiveBlock((b) => Math.min(blockCount - 1, b + 1))}
            disabled={activeBlock >= blockCount - 1}
            aria-label="Next 500-day block"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </header>

      <div className="mh-progress" aria-label={`Day ${blockElapsed} of ${BLOCK_SIZE}`}>
        <span className="mh-progress-track">
          <i style={{ width: `${blockProgress}%` }} />
        </span>
        <small>
          Day {blockElapsed} <em>/ {BLOCK_SIZE}</em>
        </small>
      </div>

      <div className="mh-field">
        <div className="mh-weekdays" aria-hidden="true">
          {["M", "", "W", "", "F", "", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
          <span className="mh-weekdays-sum">wk</span>
        </div>
        <div className="mh-scroll" ref={scrollRef}>
          <div className="mh-months" aria-hidden="true">
            {weeks.map((week, wIdx) => {
              const firstOfMonth = week.find((d) => d.dateKey.endsWith("-01") && !d.isPad);
              return <span key={week[0]?.dateKey ?? wIdx}>{firstOfMonth ? firstOfMonth.monthLabel : ""}</span>;
            })}
          </div>
          <div className="mh-grid">
            {weeks.map((week, wIdx) => (
              <div key={week[0]?.dateKey ?? wIdx} className="mh-week" style={{ "--w": Math.min(wIdx, 80) } as CSSProperties}>
                {week.map((day) => {
                  const t = MOMENTUM_TIERS[day.tier];
                  if (day.isFuture) {
                    return <span key={day.dateKey} className={`mh-cell is-future${day.isPad ? " is-pad" : ""}`} aria-hidden="true" />;
                  }
                  const size = day.data && day.data.hours > 0 ? 0.34 + Math.min(1, day.data.hours / 13) * 0.66 : 0;
                  const isPinned = pinned?.dateKey === day.dateKey;
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      className={`mh-cell t${day.tier}${day.isToday ? " is-today" : ""}${isPinned ? " is-pinned" : ""}`}
                      style={{ "--c": t.accent, "--sz": size } as CSSProperties}
                      onMouseEnter={() => setHovered(day)}
                      onFocus={() => setHovered(day)}
                      onMouseLeave={() => setHovered((cur) => (cur?.dateKey === day.dateKey ? null : cur))}
                      onClick={() => setPinned((cur) => (cur?.dateKey === day.dateKey ? null : day))}
                      aria-pressed={isPinned}
                      aria-label={`${day.displayDate}: ${day.data ? `${day.data.hours.toFixed(1)} hours, ${t.label}` : "no log"}`}
                    >
                      <i className="mh-dot" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mh-weekbars" aria-hidden="true">
            {weekBars.map((bar, wIdx) => (
              <span
                key={bar.key || wIdx}
                className={bar.future ? "is-future" : undefined}
                style={{ "--h": bar.h, "--c": MOMENTUM_TIERS[bar.avgTier].accent, "--w": Math.min(wIdx, 80) } as CSSProperties}
                title={bar.future ? undefined : `${bar.total.toFixed(1)}h this week`}
              >
                <i />
              </span>
            ))}
          </div>
        </div>
      </div>

      <footer className="mh-foot">
        <div className="mh-readout" data-empty={!shown || undefined}>
          {shown && shownTier ? (
            <>
              <span className="mh-readout-badge" style={{ "--c": shown.tier ? shownTier.accent : "var(--nv-faint)" } as CSSProperties}>
                <i />
              </span>
              <div>
                <strong>
                  {shown.displayDate}
                  {shown.isToday ? <em> · today</em> : null}
                </strong>
                <span>
                  {shown.data ? (
                    <>
                      {shown.data.hours.toFixed(1)}h · {shown.data.completion}% done ·{" "}
                      <b style={{ color: shownTier.accent }}>{shownTier.label}</b>
                    </>
                  ) : (
                    "No log for this day"
                  )}
                </span>
              </div>
              {pinned ? (
                <button type="button" className="mh-unpin" onClick={() => setPinned(null)}>
                  unpin
                </button>
              ) : null}
            </>
          ) : (
            <span className="mh-hint">Hover or tap a day to read it · {stats.activeDays} days logged</span>
          )}
        </div>
        <div className="mh-legend" aria-label="Tiers">
          {MOMENTUM_TIERS.slice(1).map((t) => (
            <span key={t.tier} className="mh-legend-item" title={`${t.label} — ${t.min >= 1 ? `${t.min}h+` : "under 4h"}`}>
              <i style={{ "--c": t.accent, "--sz": 0.34 + Math.min(1, Math.max(t.min, 2) / 13) * 0.66 } as CSSProperties} />
              <span>{t.label}</span>
            </span>
          ))}
        </div>
      </footer>
    </article>
  );
}
