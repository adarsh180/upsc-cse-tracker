import Link from "next/link";
import { ArrowRight, CalendarClock, Sparkles } from "lucide-react";

import { MotionGlyph, type MotionGlyphName } from "@/components/ui/animated-icons";
import { StudySubjectIcon } from "@/components/ui/study-subject-icon";
import { cn } from "@/lib/utils";

// Devanagari marginalia for page heads — a quiet signature, not decoration.
const DEVA: Array<[RegExp, string]> = [
  [/test|error/i, "परीक्षा"],
  [/performance|analytic/i, "विश्लेषण"],
  [/mood/i, "मनोदशा"],
  [/todo/i, "कार्य"],
  [/mission/i, "अभियान"],
  [/simulat/i, "अभ्यास"],
  [/current/i, "समसामयिकी"],
  [/report/i, "प्रतिवेदन"],
  [/essay/i, "निबंध"],
  [/rank/i, "श्रेणी"],
  [/guru|ai/i, "गुरु"],
];

/**
 * Page head (Sutra): a mono kicker line, a very large title whose lines rise
 * in from a mask, a short lede, and actions. Titles should be short — two to
 * four words — with the explanation in the description.
 */
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
  glyph?: MotionGlyphName;
  icon?: React.ReactNode;
}) {
  const deva = DEVA.find(([re]) => re.test(eyebrow))?.[1];
  const words = title.trim().split(/\s+/);
  // Two balanced lines when the title is long enough to need them.
  const lines =
    words.length >= 3
      ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")]
      : [title];
  return (
    <header className="su-head su-intro">
      <div className="su-head-line">
        <span>{eyebrow}</span>
        {deva ? <span className="su-deva">{deva}</span> : null}
        <span className="su-live">Live</span>
      </div>
      <h1 className="su-title su-title-sm">
        {lines.map((line, i) => (
          <span className="su-line" key={i}>
            <span style={{ "--l": i } as React.CSSProperties}>{i === lines.length - 1 ? <>{line.replace(/[.]$/, "")}<em>.</em></> : line}</span>
          </span>
        ))}
      </h1>
      <div className="su-head-foot">
        <p className="su-lede">{description}</p>
        {actions ? <div className="su-head-tools pi2-actions">{actions}</div> : null}
      </div>
    </header>
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
      <div className="metric-card-top">
        <MotionGlyph name="analytics" size={34} />
        <div className="eyebrow metric-card-label">{label}</div>
      </div>
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
        <div className="study-card-label-row">
          <StudySubjectIcon
            slug={href.split("/").filter(Boolean).at(-1) ?? title}
            title={title}
            size={24}
            className="study-card-semantic"
          />
          <div className="tag study-card-tag">
            {badge ?? "Open workspace"}
          </div>
        </div>
        {completionPct !== undefined && (
          <CircularProgress pct={completionPct} size={52} stroke={5} color={accentColor} />
        )}
      </div>
      <div className="display study-card-title" style={{ color: accentColor }}>
        {title}
      </div>
      <p className="muted study-card-overview">{overview}</p>
      {completionPct !== undefined ? (
        <div className="study-card-progress-line" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, completionPct))}%`, background: accentColor }} />
        </div>
      ) : null}
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
