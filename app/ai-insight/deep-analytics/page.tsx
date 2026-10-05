import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getPerformanceSummary } from "@/lib/dashboard";

export const metadata = { title: "Deep analytics · Sacred Attempt" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function pearson(pairs: Array<[number, number]>) {
  if (pairs.length < 3) return null;
  const ax = avg(pairs.map((p) => p[0]));
  const ay = avg(pairs.map((p) => p[1]));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - ax) * (y - ay);
    dx += (x - ax) ** 2;
    dy += (y - ay) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : null;
}

function readR(r: number | null) {
  if (r === null) return "not enough paired days yet";
  const a = Math.abs(r);
  const strength = a > 0.6 ? "strong" : a > 0.35 ? "moderate" : a > 0.15 ? "weak" : "no real";
  return `${strength} ${r >= 0 ? "positive" : "negative"} link`;
}

export default async function DeepAnalyticsPage() {
  await requireSession();
  const perf = await getPerformanceSummary();
  const days = perf.dailyLogs;

  // Weekday rhythm (IST dates are stored at UTC midnight → getUTCDay).
  const byWeekday = WEEKDAYS.map(() => [] as number[]);
  for (const d of days) byWeekday[(d.logDate.getUTCDay() + 6) % 7].push(d.totalHours);
  const weekday = byWeekday.map((hrs, i) => ({ label: WEEKDAYS[i], avg: avg(hrs), n: hrs.length }));
  const wkMax = Math.max(1, ...weekday.map((w) => w.avg));
  const ranked = [...weekday].filter((w) => w.n).sort((a, b) => b.avg - a.avg);

  // Monthly arc.
  const months = new Map<string, number[]>();
  for (const d of days) {
    const key = d.logDate.toISOString().slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), d.totalHours]);
  }
  const monthly = [...months.entries()].map(([key, hrs]) => ({
    label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }),
    total: hrs.reduce((s, h) => s + h, 0),
    avg: avg(hrs),
    n: hrs.length,
  }));
  const mMax = Math.max(1, ...monthly.map((m) => m.total));

  // Distribution of daily hours.
  const bins = [0, 2, 4, 6, 8, 10, 12, 14];
  const hist = bins.map((lo, i) => {
    const hi = bins[i + 1] ?? Infinity;
    return { label: hi === Infinity ? `${lo}h+` : `${lo}–${hi}`, n: days.filter((d) => d.totalHours >= lo && d.totalHours < hi).length, lo };
  });
  const hMax = Math.max(1, ...hist.map((h) => h.n));

  // Consistency.
  const hrs = days.map((d) => d.totalHours);
  const mean = avg(hrs);
  const sd = Math.sqrt(avg(hrs.map((h) => (h - mean) ** 2)));
  let streak = 0;
  let best = 0;
  for (const h of hrs) {
    streak = h >= 8 ? streak + 1 : 0;
    best = Math.max(best, streak);
  }

  // Discipline × completion scatter (only days where both were scored).
  const pairs = days.filter((d) => d.disciplineScore > 0 && d.completion > 0).map((d) => [d.disciplineScore, d.completion] as [number, number]);
  const r = pearson(pairs);
  const hoursVsCompletion = pearson(days.filter((d) => d.completion > 0).map((d) => [d.totalHours, d.completion] as [number, number]));

  const W = 520;
  const H = 300;
  const pad = 34;
  const sx = (v: number) => pad + (v / 100) * (W - pad * 2);
  const sy = (v: number) => H - pad - (v / 100) * (H - pad * 2);

  return (
    <main className="page-shell editorial-page editorial-analytics su-page su-legacy pg-deep">
      <PageIntro
        eyebrow="Deep Analytics"
        title="Read the pattern"
        description="Not the numbers again — the shape behind them: which days you show up, how steady you are, and which habits actually move together."
      />

      <div className="su-figs">
        <div className="su-fig">
          <span className="su-fig-label">Steadiness</span>
          <span className="su-fig-value">±{sd.toFixed(1)}<small>h</small></span>
          <span className="su-fig-note">daily swing around {mean.toFixed(1)}h</span>
        </div>
        <div className="su-fig">
          <span className="su-fig-label">Strongest day</span>
          <span className="su-fig-value">{ranked[0]?.label ?? "—"}</span>
          <span className="su-fig-note">{ranked[0] ? `${ranked[0].avg.toFixed(1)}h average` : "log more days"}</span>
        </div>
        <div className="su-fig">
          <span className="su-fig-label">Weakest day</span>
          <span className="su-fig-value">{ranked.at(-1)?.label ?? "—"}</span>
          <span className="su-fig-note">{ranked.at(-1) ? `${ranked.at(-1)!.avg.toFixed(1)}h average` : "—"}</span>
        </div>
        <div className="su-fig">
          <span className="su-fig-label">Longest 8h run</span>
          <span className="su-fig-value">{best}<small>logs</small></span>
          <span className="su-fig-note">consecutive logged days</span>
        </div>
      </div>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">१</span>
          <h2>Weekly rhythm</h2>
          <p>Average hours by weekday. Plan the heavy subjects for the days you reliably show up.</p>
        </div>
        <div className="dp-cols dp-week">
          {weekday.map((w, i) => (
            <div key={w.label} className={`dp-col${ranked[0]?.label === w.label ? " is-best" : ""}`} style={{ "--h": w.avg / wkMax, "--i": i } as CSSProperties} title={`${w.n} logged ${w.label}s`}>
              <b>{w.avg ? w.avg.toFixed(1) : "—"}</b>
              <span className="dp-bar"><i /></span>
              <small>{w.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">२</span>
          <h2>Month by month</h2>
          <p>Total hours per month, with the average per logged day beneath.</p>
        </div>
        <div className="dp-cols dp-month">
          {monthly.map((m, i) => (
            <div key={m.label + i} className="dp-col" style={{ "--h": m.total / mMax, "--i": i } as CSSProperties}>
              <b>{Math.round(m.total)}h</b>
              <span className="dp-bar"><i /></span>
              <small>{m.label}</small>
              <em>{m.avg.toFixed(1)}h · {m.n}d</em>
            </div>
          ))}
        </div>
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">३</span>
          <h2>How your days are distributed</h2>
          <p>How many logged days fell in each band. A healthy prep leans right of 8h, with few days below 4h.</p>
        </div>
        <div className="dp-cols dp-hist">
          {hist.map((b, i) => (
            <div key={b.label} className={`dp-col${b.lo >= 8 ? " is-good" : b.lo < 4 ? " is-low" : ""}`} style={{ "--h": b.n / hMax, "--i": i } as CSSProperties}>
              <b>{b.n}</b>
              <span className="dp-bar"><i /></span>
              <small>{b.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="su-sect">
        <div className="su-sect-head">
          <span className="su-idx">४</span>
          <h2>What moves together</h2>
          <p>Each dot is a day with both scores logged. A tight diagonal means discipline and completion rise together.</p>
        </div>
        <div className="dp-corr">
          <svg viewBox={`0 0 ${W} ${H}`} className="dp-scatter" role="img" aria-label="Discipline against completion, one dot per day">
            {[25, 50, 75, 100].map((v) => (
              <g key={v} className="dp-grid">
                <line x1={sx(0)} x2={sx(100)} y1={sy(v)} y2={sy(v)} />
                <line x1={sx(v)} x2={sx(v)} y1={sy(0)} y2={sy(100)} />
                <text x={sx(0) - 6} y={sy(v) + 3} textAnchor="end">{v}</text>
                <text x={sx(v)} y={sy(0) + 16} textAnchor="middle">{v}</text>
              </g>
            ))}
            <line className="dp-diag" x1={sx(0)} y1={sy(0)} x2={sx(100)} y2={sy(100)} />
            {pairs.map(([x, y], i) => (
              <circle key={i} className="dp-dot" cx={sx(x)} cy={sy(y)} r={4.5} style={{ "--i": i } as CSSProperties}>
                <title>{`discipline ${x}, completion ${y}%`}</title>
              </circle>
            ))}
            <text className="dp-axis" x={sx(100)} y={H - 4} textAnchor="end">discipline →</text>
            <text className="dp-axis" x={6} y={pad - 12}>completion ↑</text>
          </svg>
          <dl className="dp-read">
            <div>
              <dt>Discipline × completion</dt>
              <dd>{r === null ? "—" : r.toFixed(2)}</dd>
              <span>{readR(r)} · {pairs.length} days</span>
            </div>
            <div>
              <dt>Hours × completion</dt>
              <dd>{hoursVsCompletion === null ? "—" : hoursVsCompletion.toFixed(2)}</dd>
              <span>{readR(hoursVsCompletion)}</span>
            </div>
            <p className="su-muted">
              Long hours with low completion is the classic trap: time spent, plan unfinished. When the second number is weak, plan smaller and finish more.
            </p>
            <Link href="/ai-insight/guru" className="su-btn su-btn-sm">Ask the Guru about it <ArrowUpRight size={14} /></Link>
          </dl>
        </div>
      </section>
    </main>
  );
}
