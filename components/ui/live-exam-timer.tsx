"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Gauge, Sparkles, TimerReset } from "lucide-react";

function getTimeParts(targetDate: string, nowMs = Date.now()) {
  const now = nowMs;
  const target = new Date(targetDate).getTime();
  const distance = Math.max(target - now, 0);

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((distance / (1000 * 60)) % 60);
  const seconds = Math.floor((distance / 1000) % 60);

  return { days, hours, minutes, seconds };
}

function formatDateLabel(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
  return `${day} ${month} ${date.getFullYear()}`;
}

function getCountdownState(targetDate: string, nowMs = Date.now()) {
  const target = new Date(targetDate);
  const parts = getTimeParts(targetDate, nowMs);
  const totalSeconds =
    parts.days * 24 * 60 * 60 +
    parts.hours * 60 * 60 +
    parts.minutes * 60 +
    parts.seconds;
  const progress = Math.min(100, Math.max(4, ((1200 - parts.days) / 1200) * 100));
  const weeks = Math.floor(parts.days / 7);
  const months = Math.floor(parts.days / 30);
  const phase =
    parts.days <= 120
      ? "Final assault"
      : parts.days <= 240
        ? "Test pressure"
        : parts.days <= 420
          ? "Consolidation"
          : "Foundation";

  return {
    ...parts,
    totalSeconds,
    progress: Math.round(progress),
    weeks,
    months,
    phase,
    dateLabel: formatDateLabel(target),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export type ExamReadinessProfile = {
  prelims: {
    score: number;
    label: string;
    signals: string[];
  };
  mains: {
    score: number;
    label: string;
    signals: string[];
  };
};

export function LiveExamTimer({
  label,
  targetDate,
}: {
  label: string;
  targetDate: string;
}) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeParts(targetDate, 0));

  useEffect(() => {
    setTimeLeft(getTimeParts(targetDate));
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeParts(targetDate));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [targetDate]);

  const units = useMemo(
    () => [
      { label: "Days", value: String(timeLeft.days).padStart(2, "0") },
      { label: "Hours", value: String(timeLeft.hours).padStart(2, "0") },
      { label: "Minutes", value: String(timeLeft.minutes).padStart(2, "0") },
      { label: "Seconds", value: String(timeLeft.seconds).padStart(2, "0") },
    ],
    [timeLeft],
  );

  return (
    <section className="glass panel glass-strong live-exam-timer">
      <div className="panel-title-row">
        <div>
          <div className="eyebrow">Live Timer</div>
          <div className="display" style={{ fontSize: "2rem", marginTop: 8 }}>
            {label}
          </div>
        </div>
        <div className="pill">
          <TimerReset size={14} />
          Updates every second
        </div>
      </div>

      <div className="live-timer-shell">
        <div className="live-timer-orb-wrap">
          <div className="live-timer-orb">
            <div className="live-timer-orb-core">
              <div className="live-timer-orb-label">Remaining</div>
              <div className="live-timer-orb-value">{units[0]?.value}</div>
              <div className="live-timer-orb-caption">Days to go</div>
            </div>
          </div>
        </div>

        <div className="live-timer-content">
          <div className="live-timer-kicker">
            <Sparkles size={14} />
            Every second matters now
          </div>
          <div className="live-timer-grid">
            {units.map((unit) => (
              <div key={unit.label} className="live-timer-card">
                <div className="live-timer-value">{unit.value}</div>
                <div className="live-timer-label">{unit.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExamCountdownMatrix({
  prelimsDate,
  mainsDate,
  initialNow,
  readiness,
}: {
  prelimsDate: string;
  mainsDate: string;
  initialNow: number;
  readiness: ExamReadinessProfile;
}) {
  const [nowMs, setNowMs] = useState(initialNow);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const exams = useMemo(
    () => [
      {
        key: "prelims",
        label: "UPSC Prelims 2027",
        shortLabel: "Prelims",
        targetDate: prelimsDate,
        tone: "var(--gold-bright)",
        state: getCountdownState(prelimsDate, nowMs),
        readiness: readiness.prelims,
      },
      {
        key: "mains",
        label: "UPSC Mains 2027",
        shortLabel: "Mains",
        targetDate: mainsDate,
        tone: "var(--physics)",
        state: getCountdownState(mainsDate, nowMs),
        readiness: readiness.mains,
      },
    ],
    [prelimsDate, mainsDate, readiness, nowMs],
  );

  return (
    <section className="glass panel exam-countdown-matrix">
      <div className="exam-countdown-head">
        <div>
          <div className="eyebrow">Exam Chronograph</div>
          <div className="display exam-countdown-title">Time pressure, without noise.</div>
          <p className="muted exam-countdown-copy">
            Live Prelims and Mains countdowns with phase, date, weeks, months and second-level movement in one clean instrument.
          </p>
        </div>
        <div className="pill">
          <TimerReset size={14} />
          Live every second
        </div>
      </div>

      <div className="exam-countdown-grid">
        {exams.map((exam) => {
          const { readiness, state } = exam;
          const units = [
            { label: "Days", value: String(state.days) },
            { label: "Hours", value: pad(state.hours) },
            { label: "Minutes", value: pad(state.minutes) },
            { label: "Seconds", value: pad(state.seconds) },
          ];

          return (
            <article
              key={exam.key}
              className="exam-countdown-card"
              style={
                {
                  "--exam-tone": exam.tone,
                  "--exam-progress": `${state.progress}%`,
                  "--exam-readiness": `${readiness.score}%`,
                  "--exam-second": `${state.seconds * 6}deg`,
                  "--exam-minute": `${state.minutes * 6}deg`,
                } as CSSProperties
              }
            >
              <div className="exam-countdown-card-top">
                <div>
                  <div className="pill exam-countdown-date-pill">
                    <CalendarClock size={13} />
                    {state.dateLabel}
                  </div>
                  <h3 className="display exam-countdown-card-title">{exam.shortLabel}</h3>
                </div>
                <div className="exam-countdown-phase">
                  <Gauge size={14} />
                  {state.phase}
                </div>
              </div>

              <div className="exam-countdown-body">
                <div className="exam-chronograph" aria-hidden="true">
                  <div className="exam-readiness-arc" />
                  <div className="exam-chronograph-ring" />
                  <div className="exam-chronograph-sweep second" />
                  <div className="exam-chronograph-sweep minute" />
                  <div className="exam-chronograph-core">
                    <strong>{state.days}</strong>
                    <span>days</span>
                  </div>
                </div>

                <div className="exam-countdown-side">
                  <div className="exam-readiness-panel">
                    <span>Live readiness</span>
                    <strong>{readiness.score}%</strong>
                    <em>{readiness.label}</em>
                  </div>
                  <div className="exam-countdown-units">
                    {units.map((unit) => (
                      <div key={unit.label} className="exam-countdown-unit">
                        <strong>{unit.value}</strong>
                        <span>{unit.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="exam-countdown-meta">
                <div>
                  <span>Weeks</span>
                  <strong>{state.weeks}</strong>
                </div>
                <div>
                  <span>Months</span>
                  <strong>{state.months}</strong>
                </div>
                <div>
                  <span>Readiness</span>
                  <strong>{readiness.score}%</strong>
                </div>
                <div>
                  <span>Time used</span>
                  <strong>{state.progress}%</strong>
                </div>
              </div>

              <div className="exam-readiness-signals">
                {readiness.signals.map((signal) => (
                  <span key={signal}>{signal}</span>
                ))}
              </div>

              <div className="exam-countdown-progress" aria-hidden="true">
                <span />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
