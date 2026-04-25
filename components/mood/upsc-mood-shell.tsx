"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Brain, CalendarDays, Flame, HeartPulse, Save, ShieldCheck, Target, Zap } from "lucide-react";

import { MoodSignalChart } from "@/components/charts/analytics-charts";
import { MotionGlyph } from "@/components/ui/animated-icons";
import { PageIntro } from "@/components/ui/sections";

type MoodEntry = {
  id: string;
  date: string;
  label: string;
  energy: number;
  focus: number;
  stress: number;
  confidence: number;
  consistency: number;
  notes: string;
};

type MoodOption = {
  key: string;
  icon: typeof Zap;
  color: string;
  bg: string;
  border: string;
  path: string;
};

const IST_TIME_ZONE = "Asia/Kolkata";

const moodOptions: MoodOption[] = [
  {
    key: "Locked in",
    icon: Flame,
    color: "var(--gold)",
    bg: "rgba(245, 208, 97, 0.12)",
    border: "rgba(245, 208, 97, 0.26)",
    path: "M26 42c-6-6-5-14 2-20 0 6 4 9 8 12 4-6 3-10-1-16 10 5 15 14 12 23-2 7-8 11-15 11-2 0-4 0-6-2Z",
  },
  {
    key: "Steady",
    icon: Brain,
    color: "var(--physics)",
    bg: "rgba(94, 161, 255, 0.12)",
    border: "rgba(94, 161, 255, 0.26)",
    path: "M18 34c0-8 6-15 14-15s14 7 14 15-6 15-14 15-14-7-14-15Zm9 0h10",
  },
  {
    key: "Calm",
    icon: ShieldCheck,
    color: "var(--botany)",
    bg: "rgba(101, 240, 181, 0.11)",
    border: "rgba(101, 240, 181, 0.25)",
    path: "M32 17c8 4 13 4 18 4-1 15-7 25-18 31-11-6-17-16-18-31 5 0 10 0 18-4Z",
  },
  {
    key: "Drained",
    icon: Zap,
    color: "#ffb86b",
    bg: "rgba(255, 184, 107, 0.11)",
    border: "rgba(255, 184, 107, 0.25)",
    path: "M35 14 20 37h11l-3 13 16-24H33l2-12Z",
  },
  {
    key: "Overloaded",
    icon: HeartPulse,
    color: "var(--rose-bright)",
    bg: "rgba(255, 138, 161, 0.11)",
    border: "rgba(255, 138, 161, 0.25)",
    path: "M16 34h9l4-10 6 20 5-10h8",
  },
];

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function clampMetric(value: number) {
  return Math.max(1, Math.min(10, value));
}

function formatIstDateKey(date: Date) {
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

function formatIstLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST_TIME_ZONE, ...options }).format(date);
}

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00+05:30`);
}

function entryKey(entry: MoodEntry) {
  return formatIstDateKey(new Date(entry.date));
}

function MoodMark({ mood, large = false }: { mood: MoodOption; large?: boolean }) {
  return (
    <span
      className={`mood-mark${large ? " large" : ""}`}
      style={{ "--mood-color": mood.color, "--mood-bg": mood.bg, "--mood-border": mood.border } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64">
        <circle className="mood-mark-orbit" cx="32" cy="32" r="22" />
        <path className="mood-mark-path" d={mood.path} />
      </svg>
    </span>
  );
}

function MoodSlider({
  icon: Icon,
  label,
  value,
  color,
  onChange,
}: {
  icon: typeof Zap;
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mood-v2-slider">
      <div className="mood-v2-slider-head">
        <span style={{ color }}>
          <Icon size={16} />
          {label}
        </span>
        <strong style={{ color }}>{value}/10</strong>
      </div>
      <div className="mood-v2-slider-track">
        <span style={{ width: `${clampMetric(value) * 10}%`, background: color }} />
        <input
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function UpscMoodShell({ initialEntries }: { initialEntries: MoodEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [selectedDate, setSelectedDate] = useState(formatIstDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    label: "Steady",
    energy: 6,
    focus: 6,
    stress: 4,
    confidence: 6,
    consistency: 6,
    notes: "",
  });

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    entries.forEach((entry) => map.set(entryKey(entry), entry));
    return map;
  }, [entries]);

  useEffect(() => {
    const existing = entriesByDate.get(selectedDate);
    if (existing) {
      setForm({
        label: existing.label,
        energy: existing.energy,
        focus: existing.focus,
        stress: existing.stress,
        confidence: existing.confidence,
        consistency: existing.consistency,
        notes: existing.notes ?? "",
      });
      return;
    }

    setForm({
      label: "Steady",
      energy: 6,
      focus: 6,
      stress: 4,
      confidence: 6,
      consistency: 6,
      notes: "",
    });
  }, [entriesByDate, selectedDate]);

  async function fetchEntries() {
    const response = await fetch("/api/mood?days=30", { cache: "no-store" });
    if (!response.ok) return;
    const nextEntries = (await response.json()) as MoodEntry[];
    setEntries(nextEntries);
  }

  async function saveMood() {
    setSaving(true);

    const response = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedDate,
        ...form,
      }),
    });

    setSaving(false);
    if (!response.ok) return;

    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    await fetchEntries();
  }

  const recentEntries = entries.slice(0, 7);
  const currentMood = moodOptions.find((mood) => mood.key === form.label) ?? moodOptions[1];
  const selectedDateObject = dateFromKey(selectedDate);
  const last30 = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - index));
        return {
          key: formatIstDateKey(date),
          label: formatIstLabel(date, { day: "numeric" }),
        };
      }),
    [],
  );
  const moodScore = Math.round((form.energy + form.focus + form.confidence + form.consistency + (11 - form.stress)) / 5);
  const avgEnergy = average(recentEntries.map((entry) => entry.energy));
  const avgFocus = average(recentEntries.map((entry) => entry.focus));
  const avgStress = average(recentEntries.map((entry) => entry.stress));
  const avgConfidence = average(recentEntries.map((entry) => entry.confidence));
  const chartData = [...entries]
    .reverse()
    .map((entry) => ({
      label: formatIstLabel(new Date(entry.date), { day: "2-digit", month: "short" }),
      focus: entry.focus,
      energy: entry.energy,
      stress: entry.stress,
      confidence: entry.confidence,
      consistency: entry.consistency,
    }));

  return (
    <main className="page-shell mood-page-v2">
      <PageIntro
        eyebrow="Mood Tracker"
        title="Mental state cockpit."
        description="Focus, energy, stress, confidence and consistency without clutter."
        glyph="mood"
        actions={<div className="pill">{recentEntries.length} recent entries</div>}
      />

      <section className="section-stack mood-v2-stack">
        <section className="mood-v2-hero-grid">
          <article className="glass panel mood-v2-current">
            <div className="mood-v2-current-top">
              <MoodMark mood={currentMood} large />
              <div>
                <div className="eyebrow">Selected state</div>
                <div className="display mood-v2-title">{currentMood.key}</div>
                <div className="mood-v2-date-label">
                  <CalendarDays size={14} />
                  {formatIstLabel(selectedDateObject, { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
            <div className="mood-v2-score-ring" style={{ "--mood-score": `${moodScore * 10}%`, color: currentMood.color } as CSSProperties}>
              <div>
                <strong>{moodScore}</strong>
                <span>/10</span>
              </div>
            </div>
          </article>

          <article className="glass panel mood-v2-date-panel">
            <div>
              <div className="eyebrow">Date</div>
              <div className="display mood-v2-panel-title">Daily check-in</div>
            </div>
            <input
              className="field"
              type="date"
              value={selectedDate}
              max={formatIstDateKey(new Date())}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <button type="button" className="button mood-v2-save" onClick={() => void saveMood()} disabled={saving}>
              <Save size={16} />
              {saved ? "Saved" : saving ? "Saving..." : "Save mood"}
            </button>
          </article>

          {[
            { label: "Energy", value: avgEnergy, icon: Zap, color: "var(--gold)" },
            { label: "Focus", value: avgFocus, icon: Brain, color: "var(--physics)" },
            { label: "Stress", value: avgStress, icon: HeartPulse, color: avgStress >= 7 ? "var(--rose-bright)" : "var(--botany)" },
            { label: "Confidence", value: avgConfidence, icon: ShieldCheck, color: "var(--botany)" },
          ].map((metric) => (
            <article key={metric.label} className="glass panel mood-v2-stat">
              <span style={{ color: metric.color }}>
                <metric.icon size={16} />
              </span>
              <small>{metric.label}</small>
              <strong style={{ color: metric.color }}>{metric.value}/10</strong>
            </article>
          ))}
        </section>

        <section className="mood-v2-layout">
          <div className="mood-v2-left">
            <article className="glass panel mood-v2-card">
              <div className="mood-v2-card-head">
                <div>
                  <div className="eyebrow">Mood</div>
                  <div className="display mood-v2-panel-title">State selector</div>
                </div>
                <MotionGlyph name="mood" size={42} />
              </div>
              <div className="mood-v2-options">
                {moodOptions.map((mood) => {
                  const Icon = mood.icon;
                  const active = form.label === mood.key;

                  return (
                    <button
                      key={mood.key}
                      type="button"
                      className={`mood-v2-option${active ? " active" : ""}`}
                      style={{ "--mood-color": mood.color, "--mood-bg": mood.bg, "--mood-border": mood.border } as CSSProperties}
                      onClick={() => setForm((current) => ({ ...current, label: mood.key }))}
                    >
                      <MoodMark mood={mood} />
                      <span>
                        <Icon size={14} />
                        {mood.key}
                      </span>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="glass panel mood-v2-card">
              <div className="eyebrow">Metrics</div>
              <div className="mood-v2-slider-stack">
                <MoodSlider icon={Zap} label="Energy" value={form.energy} color="var(--gold)" onChange={(value) => setForm((current) => ({ ...current, energy: value }))} />
                <MoodSlider icon={Brain} label="Focus" value={form.focus} color="var(--physics)" onChange={(value) => setForm((current) => ({ ...current, focus: value }))} />
                <MoodSlider icon={HeartPulse} label="Stress" value={form.stress} color={form.stress >= 7 ? "var(--rose-bright)" : "var(--botany)"} onChange={(value) => setForm((current) => ({ ...current, stress: value }))} />
                <MoodSlider icon={ShieldCheck} label="Confidence" value={form.confidence} color="var(--botany)" onChange={(value) => setForm((current) => ({ ...current, confidence: value }))} />
                <MoodSlider icon={Target} label="Consistency" value={form.consistency} color="var(--lotus-bright)" onChange={(value) => setForm((current) => ({ ...current, consistency: value }))} />
              </div>
            </article>

            <article className="glass panel mood-v2-card">
              <div className="eyebrow">Note</div>
              <textarea
                className="textarea mood-v2-note"
                placeholder="What affected preparation today?"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              />
            </article>
          </div>

          <div className="mood-v2-right">
            <article className="glass panel mood-v2-card mood-v2-chart-card">
              <div className="mood-v2-card-head">
                <div>
                  <div className="eyebrow">Signal curve</div>
                  <div className="display mood-v2-panel-title">30-day mood graph</div>
                </div>
                <div className="pill">Live</div>
              </div>
              <MoodSignalChart data={chartData} />
            </article>

            <article className="glass panel mood-v2-card">
              <div className="mood-v2-card-head">
                <div>
                  <div className="eyebrow">Calendar</div>
                  <div className="display mood-v2-panel-title">Last 30 days</div>
                </div>
                <div className="pill">IST</div>
              </div>
              <div className="mood-v2-calendar">
                {last30.map((day) => {
                  const entry = entriesByDate.get(day.key);
                  const mood = moodOptions.find((option) => option.key === entry?.label);
                  const selected = day.key === selectedDate;

                  return (
                    <button
                      key={day.key}
                      type="button"
                      className={`mood-v2-day${selected ? " selected" : ""}${entry ? " logged" : ""}`}
                      style={
                        mood
                          ? ({ "--mood-color": mood.color, "--mood-bg": mood.bg, "--mood-border": mood.border } as CSSProperties)
                          : undefined
                      }
                      onClick={() => setSelectedDate(day.key)}
                      title={entry ? `${day.key}: ${entry.label}` : day.key}
                    >
                      {entry ? <MoodMark mood={mood ?? moodOptions[1]} /> : <span>{day.label}</span>}
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="glass panel mood-v2-card">
              <div className="mood-v2-card-head">
                <div>
                  <div className="eyebrow">Recent</div>
                  <div className="display mood-v2-panel-title">Mood ledger</div>
                </div>
                <div className="pill">{recentEntries.length}</div>
              </div>
              <div className="mood-v2-entry-list">
                {recentEntries.length ? (
                  recentEntries.map((entry) => {
                    const mood = moodOptions.find((option) => option.key === entry.label) ?? moodOptions[1];

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className="mood-v2-entry"
                        style={{ "--mood-color": mood.color, "--mood-bg": mood.bg, "--mood-border": mood.border } as CSSProperties}
                        onClick={() => setSelectedDate(entryKey(entry))}
                      >
                        <MoodMark mood={mood} />
                        <span>
                          <strong>{entry.label}</strong>
                          <small>
                            {formatIstLabel(new Date(entry.date), { day: "2-digit", month: "short" })} | focus {entry.focus}/10 | stress {entry.stress}/10
                          </small>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="muted mood-v2-empty">No mood entries yet.</div>
                )}
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}
