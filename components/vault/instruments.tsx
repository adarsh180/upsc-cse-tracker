import Link from "next/link";
import type { CSSProperties } from "react";

import type { VaultMetrics } from "@/lib/vault/metrics";
import { ROADMAP, TOTAL_WEEKS, titleCase } from "@/lib/vault/roadmap";

/* ── 48-week timeline ──────────────────────────────────────────────── */
export function Timeline({ m }: { m: VaultMetrics }) {
  const nowPct = Math.min(100, (m.weeksElapsed / TOTAL_WEEKS) * 100);
  return (
    <div className="fg-timeline" role="img" aria-label={`Week ${m.week} of 48`}>
      <div className="fg-timeline-track">
        {ROADMAP.stages.map((s) => {
          const sc = m.stages[s.n - 1];
          return (
            <span key={s.n} className={sc.passed ? "is-passed" : ""} style={{ "--w": s.weeks[1] - s.weeks[0] + 1, "--s": sc.score } as CSSProperties} title={`${s.n} ${titleCase(s.title)} · weeks ${s.weeks[0]}–${s.weeks[1]} · ${Math.round(sc.score * 100)}%`}>
              <b>{s.n}</b>
            </span>
          );
        })}
      </div>
      <i className="fg-timeline-now" style={{ left: `${nowPct}%` }} data-label={`now · wk ${m.week}`} />
    </div>
  );
}

/* ── Gate dependency map ───────────────────────────────────────────── */
export function GateMap({ m }: { m: VaultMetrics }) {
  let i = 0;
  return (
    <div className="fg-dag">
      {m.dag.map((lane) => (
        <div key={lane.key} className="fg-lane">
          <span className="fg-lane-label">{lane.label.toUpperCase()}</span>
          <div className="fg-lane-nodes">
            <i className={`fg-wire ${lane.nodes.every((n) => n.passed) ? "is-live" : ""}`} aria-hidden="true" />
            {lane.nodes.map((n) => (
              <Link
                key={n.n}
                href={`/vault/stage/${n.n}`}
                className={`fg-node ${n.passed ? "is-passed" : ""} ${n.n === m.currentStage ? "is-current" : ""}`}
                style={{ "--s": n.score, "--i": i++ } as CSSProperties}
              >
                <span className="fg-node-n">GATE {String(n.n).padStart(2, "0")}</span>
                <b>{titleCase(n.title)}</b>
                <span className="fg-node-pct">{n.passed ? "PASSED" : `${Math.round(n.score * 100)}%`}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── 365-day heatmap ───────────────────────────────────────────────── */
export function CalendarHeat({ m }: { m: VaultMetrics }) {
  const level = (min: number) => (min <= 0 ? 0 : min < 60 ? 1 : min < 150 ? 2 : min < 240 ? 3 : 4);
  return (
    <>
      <div className="fg-cal" role="img" aria-label="Study minutes per day over the last year">
        {m.calendar.map((d) => (
          <i key={d.date} data-l={level(d.minutes)} className={d.future ? "is-future" : ""} title={`${d.date} · ${Math.round(d.minutes)} min`} />
        ))}
      </div>
      <div className="fg-legend">
        <span>less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <i key={l} className="fg-cal-key" style={{ background: l === 0 ? "var(--fg-panel-2)" : l === 4 ? "var(--fg-lime)" : `color-mix(in srgb, var(--fg-cyan) ${[0, 25, 50, 80][l]}%, transparent)` }} />
        ))}
        <span>4h+ · {m.hours.streak}-day streak · {Math.round(m.hours.total)}h total</span>
      </div>
    </>
  );
}

/* ── 48-week grid: planned stage colour, bar height = hours that week ─ */
export function WeekGrid({ m }: { m: VaultMetrics }) {
  const max = Math.max(60, ...m.weekGrid.map((w) => w.minutes));
  return (
    <>
      <div className="fg-weeks" role="img" aria-label="Hours per week across the 48-week plan">
        {m.weekGrid.map((w) => (
          <span
            key={w.week}
            className={`${w.past ? "is-past" : ""} ${w.current ? "is-current" : ""}`}
            style={{ "--h": w.minutes / max, "--st": w.plannedStage } as CSSProperties}
            title={`Week ${w.week} · stage ${w.plannedStage} · ${(w.minutes / 60).toFixed(1)}h`}
          />
        ))}
      </div>
      <div className="fg-weeks-axis">
        {m.weekGrid.map((w) => (
          <span key={w.week}>{w.week}</span>
        ))}
      </div>
    </>
  );
}

/* ── 13 × 8 concept mastery matrix ─────────────────────────────────── */
export function ConceptMatrix({ m }: { m: VaultMetrics }) {
  return (
    <>
      <div className="fg-matrix">
        {m.conceptMatrix.map((row, si) => (
          <div key={si} className="fg-matrix-row">
            <b>S{String(si + 1).padStart(2, "0")}</b>
            {row.map((c, ci) => (
              <Link key={ci} href={`/vault/stage/${si + 1}#concepts`} data-s={c.status} title={`${titleCase(c.title)} · ${c.status}`} aria-label={`${c.title}: ${c.status}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="fg-legend">
        <span><i style={{ background: "var(--fg-panel-2)" }} />not started</span>
        <span><i style={{ background: "color-mix(in srgb, var(--fg-amber) 55%, transparent)" }} />learning</span>
        <span><i style={{ background: "color-mix(in srgb, var(--fg-cyan) 65%, transparent)" }} />explained</span>
        <span><i style={{ background: "var(--fg-lime)" }} />proven</span>
      </div>
    </>
  );
}

/* ── Cadence: target ring outside, your last 28 days inside ─────────── */
const MIX = [
  { key: "reading", label: "Reading + math", color: "var(--fg-violet)" },
  { key: "implementation", label: "Implementation", color: "var(--fg-cyan)" },
  { key: "adversarial", label: "Adversarial testing", color: "var(--fg-amber)" },
  { key: "review", label: "Design review", color: "var(--fg-lime)" },
] as const;

export function CadenceRing({ m }: { m: VaultMetrics }) {
  const ring = (shares: number[], r: number, w: number) => {
    let c = 0;
    return shares.map((s, i) => {
      const len = Math.max(0, s * 100 - (s > 0 ? 1 : 0));
      const el = <circle key={i} cx="100" cy="100" r={r} fill="none" stroke={MIX[i].color} strokeWidth={w} pathLength={100} strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-c} />;
      c += s * 100;
      return el;
    });
  };
  const target = [ROADMAP.cadence.reading, ROADMAP.cadence.implementation, ROADMAP.cadence.adversarial, ROADMAP.cadence.review];
  const actual = [m.mix.reading, m.mix.implementation, m.mix.adversarial, m.mix.review];
  const hasMix = actual.some((x) => x > 0);
  return (
    <div className="fg-cadence">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <g transform="rotate(-90 100 100)" opacity="0.45">{ring(target, 88, 8)}</g>
        <g transform="rotate(-90 100 100)">{hasMix ? ring(actual, 66, 18) : <circle cx="100" cy="100" r="66" fill="none" stroke="var(--fg-panel-2)" strokeWidth="18" />}</g>
        <text x="100" y="96" textAnchor="middle" style={{ fill: "var(--fg-ink)", font: "700 26px var(--font-forge)" }}>{Math.round(m.cadenceFit * 100)}%</text>
        <text x="100" y="116" textAnchor="middle" style={{ fill: "var(--fg-ink-3)", font: "500 9px var(--font-forge-mono)" }}>CADENCE FIT</text>
      </svg>
      <ul>
        {MIX.map((x, i) => (
          <li key={x.key}>
            <i style={{ background: x.color }} />
            <span>{x.label}</span>
            <b>{Math.round(actual[i] * 100)}%</b>
            <em>target {Math.round(target[i] * 100)}% · {Math.round(m.mixMinutes[x.key] / 60)}h in 28 days</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Rubric radar (manual page 50) ─────────────────────────────────── */
export function RubricRadar({ m }: { m: VaultMetrics }) {
  const n = m.rubric.length;
  const pt = (i: number, f: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [150 + Math.cos(a) * 110 * f, 140 + Math.sin(a) * 110 * f];
  };
  const poly = (fs: number[]) => fs.map((f, i) => pt(i, f).join(",")).join(" ");
  const earned = m.rubric.map((r) => r.earned / r.points);
  const hasSelf = m.rubric.some((r) => r.self !== null);
  return (
    <div className="fg-radar">
      <svg viewBox="0 0 300 290" role="img" aria-label={`Rubric ${m.rubricTotal} of 100`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} className="web" points={poly(Array(n).fill(f))} />
        ))}
        {m.rubric.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} className="ax" x1="150" y1="140" x2={x} y2={y} />;
        })}
        <polygon className="earned" points={poly(earned.map((x) => Math.max(0.02, x)))} />
        {hasSelf ? <polygon className="self" points={poly(m.rubric.map((r) => (r.self ?? 0) / r.points))} /> : null}
        {m.rubric.map((r, i) => {
          const [x, y] = pt(i, 1.2);
          return (
            <text key={r.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
              {r.label.split(" + ")[0]} {r.earned}/{r.points}
            </text>
          );
        })}
      </svg>
      <div className="fg-legend">
        <span><i style={{ background: "var(--fg-cyan)" }} />from gate evidence</span>
        {hasSelf ? <span><i style={{ background: "var(--fg-violet)" }} />your last self-score</span> : null}
        <span>total {m.rubricTotal}/100 · exit bar 85</span>
      </div>
    </div>
  );
}

/* ── Benchmarks over time ──────────────────────────────────────────── */
export function BenchChart({ m }: { m: VaultMetrics }) {
  const pts = m.benchmarks.filter((b) => b.p95 !== null);
  if (!pts.length) {
    return (
      <div className="fg-empty">
        <b>No benchmarks yet</b>
        Log an artifact with p50/p95 and memory on the Log page — every gate expects measured latency, not a demo.
      </div>
    );
  }
  const W = 600;
  const H = 200;
  const maxY = Math.max(...pts.map((p) => p.p95 ?? 0)) * 1.15 || 1;
  const x = (i: number) => (pts.length === 1 ? W / 2 : 30 + (i / (pts.length - 1)) * (W - 50));
  const y = (v: number) => H - 24 - (v / maxY) * (H - 44);
  const path = (k: "p95" | "p50") => pts.map((p, i) => (p[k] === null ? "" : `${i ? "L" : "M"}${x(i)},${y(p[k] as number)}`)).join(" ");
  return (
    <div className="fg-bench">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="p95 latency across artifacts">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} className="grid" x1="30" x2={W - 20} y1={y(maxY * f)} y2={y(maxY * f)} />
        ))}
        <path className="line" d={path("p95")} />
        <path className="line2" d={path("p50")} />
        {pts.map((p, i) => (
          <g key={p.id}>
            <circle className="dot" cx={x(i)} cy={y(p.p95 as number)} r="4" />
            <text x={x(i)} y={H - 6} textAnchor="middle">S{p.stage}</text>
          </g>
        ))}
        <text x="0" y={y(maxY) + 4}>{Math.round(maxY)}ms</text>
      </svg>
      <div className="fg-legend">
        <span><i style={{ background: "var(--fg-cyan)" }} />p95</span>
        <span><i style={{ background: "var(--fg-violet)" }} />p50</span>
      </div>
    </div>
  );
}
