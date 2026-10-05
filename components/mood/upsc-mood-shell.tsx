"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Brain, CalendarDays, Flame, HeartPulse, Save, ShieldCheck, Target, Zap } from "lucide-react";

import { MetricLine } from "@/components/su/metric-line";
import { LiquidMeter } from "@/components/ui/liquid-meter";
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
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  const fill = (clampMetric(value) - 1) / 9;
  return (
    <label className="od-slider md-slider" style={{ "--fill": fill, "--su-acc": color } as CSSProperties}>
      <span className="od-slider-top">
        <span>{label}</span>
        <b>
          {value}
          <small>/10</small>
        </b>
      </span>
      <span className="od-track">
        <input type="range" min={1} max={10} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={label} />
      </span>
    </label>
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
  const series = [...entries].reverse().map((entry) => ({
    x: formatIstLabel(new Date(entry.date), { day: "2-digit", month: "short" }),
    sub: entry.label,
    values: {
      focus: entry.focus,
      energy: entry.energy,
      stress: entry.stress,
      confidence: entry.confidence,
      consistency: entry.consistency,
    },
  }));
  const set = (key: "energy" | "focus" | "stress" | "confidence" | "consistency") => (value: number) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <main className="page-shell editorial-page editorial-mood su-page su-legacy pg-mood">
      <PageIntro
        eyebrow="Mood Tracker"
        title="Mind check"
        description="Twenty seconds a day: how you feel, how focused, how stressed. Burnout shows up here before it shows up in your scores."
        actions={
          <button type="button" className="su-btn su-btn-ink" onClick={() => void saveMood()} disabled={saving}>
            <Save size={15} />
            {saved ? "Saved" : saving ? "Saving…" : "Save check-in"}
          </button>
        }
      />

      <section className="su-sect md-checkin" style={{ "--mood": currentMood.color } as CSSProperties}>
        <div className="md-state">
          <div className="md-orb nv-root" style={{ "--sx-accent": currentMood.color } as CSSProperties}>
            <LiquidMeter pct={moodScore * 10} id={`mood-${selectedDate}`} label={`Mood score ${moodScore} of 10`}>
              <strong>
                {moodScore}
                <em>/10</em>
              </strong>
              <span>mood score</span>
            </LiquidMeter>
          </div>
          <div className="md-state-copy">
            <span className="su-fig-label">State · {formatIstLabel(selectedDateObject, { weekday: "short", day: "numeric", month: "short" })}</span>
            <strong className="md-state-name">{currentMood.key}</strong>
            <label className="md-date">
              <CalendarDays size={14} />
              <input type="date" value={selectedDate} max={formatIstDateKey(new Date())} onChange={(event) => setSelectedDate(event.target.value)} aria-label="Check-in date" />
            </label>
            <div className="md-options" role="radiogroup" aria-label="Mood state">
              {moodOptions.map((mood) => {
                const active = form.label === mood.key;
                return (
                  <button
                    key={mood.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`md-option${active ? " active" : ""}`}
                    style={{ "--mood-color": mood.color, "--mood-bg": mood.bg, "--mood-border": mood.border } as CSSProperties}
                    onClick={() => setForm((current) => ({ ...current, label: mood.key }))}
                  >
                    <MoodMark mood={mood} />
                    <span>{mood.key}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="md-dials">
          <MoodSlider label="Energy" value={form.energy} color="var(--su-warn)" onChange={set("energy")} />
          <MoodSlider label="Focus" value={form.focus} color="var(--nv-a1)" onChange={set("focus")} />
          <MoodSlider label="Stress" value={form.stress} color={form.stress >= 7 ? "var(--su-bad)" : "var(--su-good)"} onChange={set("stress")} />
          <MoodSlider label="Confidence" value={form.confidence} color="var(--su-good)" onChange={set("confidence")} />
          <MoodSlider label="Consistency" value={form.consistency} color="var(--nv-a2)" onChange={set("consistency")} />
          <textarea
            className="textarea md-note"
            placeholder="What affected preparation today?"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </div>
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">१</span>
          <h2>Thirty days</h2>
          <p>Each mark is a day you checked in, coloured by state. Tap one to open it above.</p>
        </div>
        <div className="md-strip">
          {last30.map((day) => {
            const entry = entriesByDate.get(day.key);
            const mood = moodOptions.find((option) => option.key === entry?.label);
            const selected = day.key === selectedDate;
            return (
              <button
                key={day.key}
                type="button"
                className={`md-day${selected ? " selected" : ""}${entry ? " logged" : ""}`}
                style={mood ? ({ "--mood-color": mood.color } as CSSProperties) : undefined}
                onClick={() => setSelectedDate(day.key)}
                title={entry ? `${day.key}: ${entry.label}` : day.key}
              >
                <i />
                <span>{day.label}</span>
              </button>
            );
          })}
        </div>
        <div className="su-figs md-avgs">
          {[
            { label: "Energy · last 7", value: avgEnergy },
            { label: "Focus", value: avgFocus },
            { label: "Stress", value: avgStress },
            { label: "Confidence", value: avgConfidence },
          ].map((m) => (
            <div className="su-fig" key={m.label}>
              <span className="su-fig-label">{m.label}</span>
              <span className="su-fig-value">
                {recentEntries.length ? m.value : "—"}
                <small>/10</small>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">२</span>
          <h2>Signals</h2>
          <p>Switch between the five signals; scrub to read a check-in.</p>
        </div>
        <MetricLine
          series={series}
          height={260}
          emptyText="Save a check-in to start the curve."
          metrics={[
            { key: "focus", label: "Focus", max: 10, decimals: 0 },
            { key: "energy", label: "Energy", max: 10, tone: "warn", decimals: 0 },
            { key: "stress", label: "Stress", max: 10, tone: "bad", decimals: 0 },
            { key: "confidence", label: "Confidence", max: 10, tone: "good", decimals: 0 },
            { key: "consistency", label: "Consistency", max: 10, tone: "ink", decimals: 0 },
          ]}
        />
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">३</span>
          <h2>Ledger</h2>
        </div>
        <div className="md-ledger">
          {recentEntries.length ? (
            recentEntries.map((entry) => {
              const mood = moodOptions.find((option) => option.key === entry.label) ?? moodOptions[1];
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="md-entry"
                  style={{ "--mood-color": mood.color, "--mood-bg": mood.bg, "--mood-border": mood.border } as CSSProperties}
                  onClick={() => setSelectedDate(entryKey(entry))}
                >
                  <MoodMark mood={mood} />
                  <strong>{entry.label}</strong>
                  <span>{formatIstLabel(new Date(entry.date), { weekday: "short", day: "2-digit", month: "short" })}</span>
                  <span className="md-entry-nums">
                    focus <b>{entry.focus}</b> · stress <b>{entry.stress}</b> · energy <b>{entry.energy}</b>
                  </span>
                  {entry.notes ? <em>{entry.notes}</em> : null}
                </button>
              );
            })
          ) : (
            <div className="su-empty">
              <strong>No check-ins yet</strong>
              Save your first one above.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
