import Link from "next/link";
import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="glass panel hero-grid landing-hero">
      <div style={{ alignSelf: "center" }}>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display" style={{ fontSize: "clamp(3rem, 6vw, 5.4rem)", margin: "14px 0 12px", lineHeight: 1.02 }}>
          {title}
        </h1>
        <p className="muted" style={{ maxWidth: 760, fontSize: "1.05rem", lineHeight: 1.82 }}>
          {description}
        </p>
      </div>
      <div
        className="glass panel glass-strong"
        style={{
          display: "grid",
          alignContent: "space-between",
          gap: 16,
          minHeight: 240,
          background:
            "radial-gradient(circle at top right, hsla(38 72% 58% / 0.12), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
        }}
      >
        <div>
          <div className="pill">
            <Sparkles size={14} />
            Sacred tracker system
          </div>
          <div className="display" style={{ fontSize: "1.8rem", marginTop: 16 }}>
            Built for a hard third attempt.
          </div>
          <p className="muted" style={{ marginTop: 10, lineHeight: 1.8 }}>
            Timers, test evidence, discipline signals, AI interrogation and database-backed study control in one premium workspace.
          </p>
        </div>
        <div style={{ display: "grid", gap: 12, justifyItems: "stretch" }}>{actions}</div>
      </div>
    </section>
  );
}

export function CountdownCard({
  label,
  days,
  dateLabel,
  tone = "var(--cyan)",
}: {
  label: string;
  days: number;
  dateLabel: string;
  tone?: string;
}) {
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const progress = Math.min(100, Math.max(6, ((1200 - days) / 1200) * 100));

  return (
    <article className="glass panel countdown-card" style={{ color: tone }}>
      <div className="pill">
        <CalendarClock size={14} />
        {label}
      </div>
      <div className="countdown-number">
        <div className="display" style={{ fontSize: "clamp(3.4rem, 9vw, 6rem)", lineHeight: 0.9 }}>
          {days}
        </div>
        <div style={{ paddingBottom: 10 }}>
          <div style={{ fontWeight: 800, color: "var(--text)" }}>days left</div>
          <div className="muted">{dateLabel}</div>
        </div>
      </div>
      <div className="countdown-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="grid grid-3" style={{ marginTop: 18, gap: 12 }}>
        <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
          <div className="muted" style={{ fontSize: "0.78rem" }}>Months</div>
          <div className="display" style={{ fontSize: "1.35rem", marginTop: 8, color: "var(--text)" }}>{months}</div>
        </div>
        <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
          <div className="muted" style={{ fontSize: "0.78rem" }}>Weeks</div>
          <div className="display" style={{ fontSize: "1.35rem", marginTop: 8, color: "var(--text)" }}>{weeks}</div>
        </div>
        <div className="glass" style={{ borderRadius: 18, padding: 14 }}>
          <div className="muted" style={{ fontSize: "0.78rem" }}>Urgency</div>
          <div className="display" style={{ fontSize: "1.35rem", marginTop: 8, color: "var(--text)" }}>
            {days < 200 ? "High" : days < 400 ? "Build" : "Foundation"}
          </div>
        </div>
      </div>
    </article>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="glass panel metric-card">
      <div className="eyebrow" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="display metric-value">{value}</div>
      <div className="muted" style={{ lineHeight: 1.7 }}>{hint}</div>
    </article>
  );
}

export function CircularProgress({
  pct,
  size = 52,
  stroke = 5,
  color = "var(--gold)",
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="circ-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="circ-bg" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="circ-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="circ-label">{Math.round(pct)}%</div>
    </div>
  );
}

export function StudyCard({
  href,
  title,
  overview,
  accent,
  badge,
  completionPct,
}: {
  href: string;
  title: string;
  overview: string | null | undefined;
  accent?: string | null;
  badge?: string;
  completionPct?: number;
}) {
  const accentColor =
    accent === "blue"
      ? "var(--physics)"
      : accent === "emerald"
        ? "var(--botany)"
        : accent === "amber"
          ? "var(--zoology)"
          : accent === "violet"
            ? "var(--lotus-bright)"
            : accent === "cyan"
              ? "var(--physics)"
              : accent === "pink"
                ? "var(--rose-bright)"
                : "var(--text)";

  return (
    <Link href={href} className="glass panel card-link">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div className="tag" style={{ marginBottom: 0 }}>
          {badge ?? "Open workspace"}
        </div>
        {completionPct !== undefined && (
          <CircularProgress pct={completionPct} size={52} stroke={5} color={accentColor} />
        )}
      </div>
      <div
        className="display"
        style={{
          fontSize: "1.7rem",
          marginBottom: 12,
          color: accentColor,
        }}
      >
        {title}
      </div>
      <p className="muted" style={{ lineHeight: 1.78, minHeight: 84 }}>
        {overview}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
        Enter page <ArrowRight size={16} />
      </div>
    </Link>
  );
}


export function SpotlightCard({
  title,
  description,
  meta,
}: {
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <article className="glass panel spotlight-card">
      <div className="pill">
        <Sparkles size={14} />
        {meta}
      </div>
      <div className="display" style={{ fontSize: "1.8rem", marginTop: 18 }}>
        {title}
      </div>
      <p className="muted" style={{ marginTop: 10, lineHeight: 1.75 }}>
        {description}
      </p>
    </article>
  );
}

export function FormGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid", "grid-2", className)} style={{ alignItems: "start" }}>
      {children}
    </div>
  );
}
