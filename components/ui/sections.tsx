import Link from "next/link";
import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";

import { SacredLogoMark } from "@/components/shell/sacred-brand";
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
    <section className="glass panel hero-grid landing-hero page-intro-shell">
      <div className="page-intro-copy">
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display page-intro-title">{title}</h1>
        <p className="muted page-intro-description">{description}</p>
      </div>
      <div className="glass panel glass-strong page-intro-aside">
        <div className="page-intro-mark">
          <SacredLogoMark size="sm" />
          <div className="page-intro-mark-glow" />
        </div>
        <div>
          <div className="pill">
            <Sparkles size={14} />
            Sacred tracker system
          </div>
          <div className="display page-intro-aside-title">Built for a hard third attempt.</div>
          <p className="muted page-intro-aside-copy">
            Timers, test evidence, discipline signals, AI interrogation and database-backed study control in one premium workspace.
          </p>
        </div>
        <div className="page-intro-actions">{actions}</div>
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
        <div className="display countdown-number-value">{days}</div>
        <div className="countdown-number-copy">
          <div className="countdown-number-label">days left</div>
          <div className="muted">{dateLabel}</div>
        </div>
      </div>
      <div className="countdown-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="grid grid-3 countdown-mini-grid">
        <div className="glass countdown-mini-card">
          <div className="muted countdown-mini-label">Months</div>
          <div className="display countdown-mini-value">{months}</div>
        </div>
        <div className="glass countdown-mini-card">
          <div className="muted countdown-mini-label">Weeks</div>
          <div className="display countdown-mini-value">{weeks}</div>
        </div>
        <div className="glass countdown-mini-card">
          <div className="muted countdown-mini-label">Urgency</div>
          <div className="display countdown-mini-value">
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
      <div className="eyebrow metric-card-label">{label}</div>
      <div className="display metric-value">{value}</div>
      <div className="muted metric-card-hint">{hint}</div>
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
    <Link href={href} className="glass panel card-link study-card-shell">
      <div className="study-card-head">
        <div className="tag study-card-tag">
          {badge ?? "Open workspace"}
        </div>
        {completionPct !== undefined && (
          <CircularProgress pct={completionPct} size={52} stroke={5} color={accentColor} />
        )}
      </div>
      <div className="display study-card-title" style={{ color: accentColor }}>
        {title}
      </div>
      <p className="muted study-card-overview">{overview}</p>
      <div className="study-card-cta">
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
