"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/** Dot-matrix days-to-exam with a live clock of the remainder. */
export function Countdown({ target, label, initialNow }: { target: string; label: string; initialNow: number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <div className="cd">
      <span className="cd-days su-dot" aria-label={`${days} days`}>{days}</span>
      <span className="cd-meta">
        <span className="cd-label">days to {label}</span>
        <span className="cd-clock" suppressHydrationWarning>
          {pad(h)}:{pad(m)}:{pad(s)}
        </span>
      </span>
    </div>
  );
}
