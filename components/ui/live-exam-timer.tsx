"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, TimerReset } from "lucide-react";

function getTimeParts(targetDate: string) {
  const now = new Date().getTime();
  const target = new Date(targetDate).getTime();
  const distance = Math.max(target - now, 0);

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((distance / (1000 * 60)) % 60);
  const seconds = Math.floor((distance / 1000) % 60);

  return { days, hours, minutes, seconds };
}

export function LiveExamTimer({
  label,
  targetDate,
}: {
  label: string;
  targetDate: string;
}) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeParts(targetDate));

  useEffect(() => {
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
