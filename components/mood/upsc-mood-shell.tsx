"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { eachDayOfInterval, format, isSameDay, subDays } from "date-fns";
import {
  Brain,
  CalendarDays,
  Flame,
  HeartPulse,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";

import { TrendChart } from "@/components/charts/analytics-charts";

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

const moodOptions = [
  {
    key: "Locked in",
    emoji: "🔥",
    color: "var(--gold)",
    bg: "rgba(212, 168, 83, 0.12)",
    border: "rgba(212, 168, 83, 0.25)",
  },
  {
    key: "Steady",
    emoji: "🧠",
    color: "var(--cyan)",
    bg: "rgba(91, 156, 245, 0.12)",
    border: "rgba(91, 156, 245, 0.25)",
  },
  {
    key: "Calm",
    emoji: "🌙",
    color: "#8cf0c0",
    bg: "rgba(101, 240, 181, 0.1)",
    border: "rgba(101, 240, 181, 0.24)",
  },
  {
    key: "Drained",
    emoji: "😮‍💨",
    color: "#ffb86b",
    bg: "rgba(255, 184, 107, 0.1)",
    border: "rgba(255, 184, 107, 0.24)",
  },
  {
    key: "Overloaded",
    emoji: "⚠️",
    color: "#ff8aa1",
    bg: "rgba(255, 138, 161, 0.1)",
    border: "rgba(255, 138, 161, 0.24)",
  },
];

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
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
    <div className="upsc-mood-slider">
      <div className="upsc-mood-slider-top">
        <div className="upsc-mood-slider-label">
          <span className="upsc-mood-slider-icon" style={{ color }}>
            <Icon size={16} />
          </span>
          <span>{label}</span>
        </div>
        <span className="upsc-mood-slider-value" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="upsc-mood-slider-track">
        <div
          className="upsc-mood-slider-fill"
          style={{ width: `${value * 10}%`, background: color }}
        />
        <input
          className="upsc-mood-slider-range"
          type="range"
          min={1}
          max={10}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <div className="upsc-mood-slider-scale">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  );
}

export function UpscMoodShell({ initialEntries }: { initialEntries: MoodEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
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

  useEffect(() => {
    const existing = entries.find((entry) => entry.date.slice(0, 10) === selectedDate);
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
  }, [entries, selectedDate]);

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
    window.setTimeout(() => setSaved(false), 1800);
    await fetchEntries();
  }

  const last30 = useMemo(
    () => eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() }),
    [],
  );

  const currentMood = moodOptions.find((mood) => mood.key === form.label) ?? moodOptions[1];
  const recentEntries = entries.slice(0, 7);
  const avgEnergy = average(recentEntries.map((entry) => entry.energy));
  const avgFocus = average(recentEntries.map((entry) => entry.focus));
  const avgStress = average(recentEntries.map((entry) => entry.stress));
  const avgConfidence = average(recentEntries.map((entry) => entry.confidence));
  const chartData = [...entries]
    .slice()
    .reverse()
    .map((entry) => ({
      label: format(new Date(entry.date), "dd MMM"),
      value: entry.focus,
      secondary: entry.energy,
    }));

  return (
    <main className="upsc-mood-page">
      <div className="upsc-mood-bg">
        <div className="upsc-mood-orb upsc-mood-orb-a" />
        <div className="upsc-mood-orb upsc-mood-orb-b" />
        <div className="upsc-mood-orb upsc-mood-orb-c" />
        <div className="upsc-mood-grid" />
      </div>

      <div className="upsc-mood-shell">
        <section className="upsc-mood-hero glass panel">
          <div className="upsc-mood-hero-copy">
            <div className="upsc-mood-kicker">
              <Sparkles size={14} />
              Daily mental telemetry
            </div>
            <h1 className="display upsc-mood-title">Mood tracker for honest preparation.</h1>
            <p className="muted upsc-mood-subtitle">
              This page now follows the sharper NEET-style mood experience. Log emotional state,
              confidence, stress, energy and consistency so UPSC Guru can detect hidden collapse
              before it shows up in your mocks.
            </p>
          </div>

          <div className="upsc-mood-date-card">
            <div className="upsc-mood-date-label">
              <CalendarDays size={14} />
              Select date
            </div>
            <input
              className="field"
              type="date"
              value={selectedDate}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
        </section>

        <section className="grid grid-4 upsc-mood-stats">
          {[
            { label: "Avg Energy", value: avgEnergy, icon: Zap, color: "var(--gold)" },
            { label: "Avg Focus", value: avgFocus, icon: Brain, color: "var(--cyan)" },
            {
              label: "Avg Stress",
              value: avgStress,
              icon: HeartPulse,
              color: avgStress >= 7 ? "#ff8aa1" : "#8cf0c0",
            },
            {
              label: "Avg Confidence",
              value: avgConfidence,
              icon: ShieldCheck,
              color: "var(--physics)",
            },
          ].map((metric) => (
            <article key={metric.label} className="glass panel upsc-mood-stat-card">
              <div className="upsc-mood-stat-head">
                <span className="upsc-mood-stat-icon" style={{ color: metric.color }}>
                  <metric.icon size={16} />
                </span>
                <span className="muted">{metric.label}</span>
              </div>
              <div className="display upsc-mood-stat-value" style={{ color: metric.color }}>
                {metric.value}
                <span>/10</span>
              </div>
              <div className="muted">Last 7 entries</div>
            </article>
          ))}
        </section>

        <section className="upsc-mood-layout">
          <div className="upsc-mood-main-column">
            <article className="glass panel upsc-mood-card">
              <div className="panel-title-row">
                <div>
                  <div className="eyebrow">How are you feeling?</div>
                  <div className="display" style={{ fontSize: "2rem", marginTop: 8 }}>
                    {format(new Date(`${selectedDate}T12:00:00`), "EEEE, d MMMM yyyy")}
                  </div>
                </div>
              </div>

              <div className="upsc-mood-pills">
                {moodOptions.map((mood) => (
                  <button
                    key={mood.key}
                    type="button"
                    className={`upsc-mood-pill ${form.label === mood.key ? "active" : ""}`}
                    style={
                      {
                        "--mood-color": mood.color,
                        "--mood-bg": mood.bg,
                        "--mood-border": mood.border,
                      } as CSSProperties
                    }
                    onClick={() => setForm((current) => ({ ...current, label: mood.key }))}
                  >
                    <span className="upsc-mood-pill-emoji">{mood.emoji}</span>
                    <span className="upsc-mood-pill-label">{mood.key}</span>
                  </button>
                ))}
              </div>

              <div
                className="upsc-mood-active"
                style={{
                  background: currentMood.bg,
                  borderColor: currentMood.border,
                }}
              >
                <div className="upsc-mood-active-emoji">{currentMood.emoji}</div>
                <div>
                  <div className="upsc-mood-active-title" style={{ color: currentMood.color }}>
                    {currentMood.key}
                  </div>
                  <p className="muted" style={{ marginTop: 6, lineHeight: 1.7 }}>
                    UPSC Guru uses this together with stress, confidence and consistency to detect
                    whether your preparation engine is stable or just forcing output.
                  </p>
                </div>
              </div>
            </article>

            <article className="glass panel upsc-mood-card">
              <div className="eyebrow">Mental state sliders</div>
              <div className="upsc-mood-slider-stack">
                <MoodSlider
                  icon={Zap}
                  label="Energy"
                  value={form.energy}
                  color="var(--gold)"
                  onChange={(value) => setForm((current) => ({ ...current, energy: value }))}
                />
                <MoodSlider
                  icon={Brain}
                  label="Focus"
                  value={form.focus}
                  color="var(--cyan)"
                  onChange={(value) => setForm((current) => ({ ...current, focus: value }))}
                />
                <MoodSlider
                  icon={HeartPulse}
                  label="Stress"
                  value={form.stress}
                  color={form.stress >= 7 ? "#ff8aa1" : "#8cf0c0"}
                  onChange={(value) => setForm((current) => ({ ...current, stress: value }))}
                />
                <MoodSlider
                  icon={ShieldCheck}
                  label="Confidence"
                  value={form.confidence}
                  color="var(--physics)"
                  onChange={(value) => setForm((current) => ({ ...current, confidence: value }))}
                />
                <MoodSlider
                  icon={Target}
                  label="Consistency"
                  value={form.consistency}
                  color="#c5d2ff"
                  onChange={(value) => setForm((current) => ({ ...current, consistency: value }))}
                />
              </div>
            </article>

            <article className="glass panel upsc-mood-card">
              <div className="eyebrow">Day note</div>
              <textarea
                className="textarea upsc-mood-note"
                placeholder="What affected your preparation today? Keep it honest."
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
              />

              <button
                type="button"
                className="button upsc-mood-save"
                onClick={() => void saveMood()}
                disabled={saving}
              >
                <Save size={16} />
                {saved ? "Saved" : saving ? "Saving..." : "Save mood log"}
              </button>
            </article>
          </div>

          <div className="upsc-mood-side-column">
            <article className="glass panel upsc-mood-card">
              <div className="panel-title-row">
                <div>
                  <div className="eyebrow">Focus vs energy</div>
                  <div className="display" style={{ fontSize: "1.6rem", marginTop: 8 }}>
                    30-day signal curve
                  </div>
                </div>
                <div className="pill">
                  <Flame size={14} />
                  Live pattern
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <TrendChart data={chartData} secondaryKey="secondary" />
              </div>
            </article>

            <article className="glass panel upsc-mood-card">
              <div className="panel-title-row">
                <div>
                  <div className="eyebrow">Mood calendar</div>
                  <div className="display" style={{ fontSize: "1.6rem", marginTop: 8 }}>
                    Last 30 days
                  </div>
                </div>
                <div className="pill">Tap a day</div>
              </div>
              <div className="upsc-mood-calendar">
                {last30.map((day) => {
                  const entry = entries.find((item) => isSameDay(new Date(item.date), day));
                  const mood = moodOptions.find((option) => option.key === entry?.label);
                  const isSelected = format(day, "yyyy-MM-dd") === selectedDate;

                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      className={`upsc-mood-calendar-day ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedDate(format(day, "yyyy-MM-dd"))}
                      style={{
                        background: mood?.bg ?? "rgba(255,255,255,0.03)",
                        borderColor: mood?.border ?? "rgba(255,255,255,0.08)",
                      }}
                    >
                      {mood ? (
                        <span className="upsc-mood-calendar-emoji">{mood.emoji}</span>
                      ) : (
                        <span className="upsc-mood-calendar-date">{format(day, "d")}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="glass panel upsc-mood-card">
              <div className="panel-title-row">
                <div>
                  <div className="eyebrow">Recent entries</div>
                  <div className="display" style={{ fontSize: "1.6rem", marginTop: 8 }}>
                    What Guru is reading
                  </div>
                </div>
                <div className="pill">{recentEntries.length} items</div>
              </div>

              <div className="upsc-mood-entry-list">
                {recentEntries.length ? (
                  recentEntries.map((entry) => {
                    const mood = moodOptions.find((option) => option.key === entry.label);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className="upsc-mood-entry-row"
                        style={{
                          background: mood?.bg ?? "rgba(255,255,255,0.03)",
                          borderColor: mood?.border ?? "rgba(255,255,255,0.08)",
                        }}
                        onClick={() => setSelectedDate(entry.date.slice(0, 10))}
                      >
                        <span className="upsc-mood-entry-emoji">{mood?.emoji ?? "•"}</span>
                        <div className="upsc-mood-entry-copy">
                          <div className="upsc-mood-entry-title">{entry.label}</div>
                          <div className="upsc-mood-entry-meta">
                            {format(new Date(entry.date), "d MMM")} · focus {entry.focus}/10 · stress{" "}
                            {entry.stress}/10 · confidence {entry.confidence}/10
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="muted">No mood entries yet. Log your first proper mood check.</div>
                )}
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
