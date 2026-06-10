"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Compass, Sparkles, TimerReset, TrendingUp, Zap } from "lucide-react";

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
        focus: "Objective edge",
        targetDate: prelimsDate,
        tone: "#f1c75b",
        gradFrom: "#f1c75b",
        gradTo: "#e87d5b",
        state: getCountdownState(prelimsDate, nowMs),
        readiness: readiness.prelims,
      },
      {
        key: "mains",
        label: "UPSC Mains 2027",
        shortLabel: "Mains",
        focus: "Answer depth",
        targetDate: mainsDate,
        tone: "#75c6f3",
        gradFrom: "#75c6f3",
        gradTo: "#9d8cf7",
        state: getCountdownState(mainsDate, nowMs),
        readiness: readiness.mains,
      },
    ],
    [prelimsDate, mainsDate, readiness, nowMs],
  );

  return (
    <section className="exam-horizon" aria-label="UPSC exam countdowns">
      <div className="exam-horizon-head">
        <div>
          <div className="exam-horizon-kicker">
            <Sparkles size={14} />
            Live UPSC timeline
          </div>
          <h2>Prelims and mains horizon</h2>
        </div>
        <div className="exam-horizon-sync">
          <span className="exam-horizon-dot" />
          <span>Second-by-second</span>
        </div>
      </div>

      <div className="exam-horizon-grid">
        {exams.map((exam) => {
          const { readiness, state } = exam;
          const progress = Math.min(100, Math.max(0, state.progress));
          const readinessPct = Math.min(100, Math.max(0, readiness.score));
          const units = [
            { label: "Hours", value: pad(state.hours) },
            { label: "Minutes", value: pad(state.minutes) },
            { label: "Seconds", value: pad(state.seconds), active: true },
          ];

          return (
            <article
              key={exam.key}
              className="exam-horizon-card"
              style={
                {
                  "--eh-tone": exam.tone,
                  "--eh-from": exam.gradFrom,
                  "--eh-to": exam.gradTo,
                  "--eh-progress": `${progress}%`,
                  "--eh-readiness": `${readinessPct}%`,
                } as CSSProperties
              }
            >
              <div className="exam-horizon-ambient" aria-hidden="true" />

              <div className="exam-horizon-main">
                <div className="exam-horizon-title-row">
                  <div>
                    <span className="exam-horizon-stage">{exam.shortLabel} 2027</span>
                    <h3>{exam.focus}</h3>
                  </div>
                  <span className="exam-horizon-phase">{state.phase}</span>
                </div>

                <div className="exam-horizon-days" role="img" aria-label={`${exam.label}: ${state.days} days left`}>
                  <span>{state.days}</span>
                  <small>days left</small>
                </div>

                <div className="exam-horizon-rail" aria-hidden="true">
                  <span className="exam-horizon-rail-fill" />
                  <span className="exam-horizon-rail-orbit" />
                </div>

                <div className="exam-horizon-meta">
                  <span>
                    <Calendar size={13} />
                    {state.dateLabel}
                  </span>
                  <span>
                    <Compass size={13} />
                    {state.months} months
                  </span>
                  <span>
                    <Zap size={13} />
                    {state.weeks} weeks
                  </span>
                </div>
              </div>

              <div className="exam-horizon-side">
                <div className="exam-horizon-clock" aria-label="live countdown">
                  {units.map((unit) => (
                    <div key={unit.label} className={unit.active ? "exam-horizon-unit is-live" : "exam-horizon-unit"}>
                      <span>{unit.value}</span>
                      <small>{unit.label}</small>
                    </div>
                  ))}
                </div>

                <div className="exam-horizon-readiness">
                  <div className="exam-horizon-readiness-top">
                    <span>
                      <TrendingUp size={13} />
                      Readiness
                    </span>
                    <strong>{readiness.score}% / {readiness.label}</strong>
                  </div>
                  <div className="exam-horizon-readiness-bar" aria-hidden="true">
                    <span />
                  </div>
                  <div className="exam-horizon-signals">
                    {readiness.signals.slice(0, 3).map((signal, index) => (
                      <span key={index}>{signal}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
