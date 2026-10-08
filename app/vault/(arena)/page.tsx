import Link from "next/link";

import { BenchChart, CadenceRing, CalendarHeat, ConceptMatrix, GateMap, RubricRadar, Timeline, WeekGrid } from "@/components/vault/instruments";
import { IconGate } from "@/components/vault/icons";
import { Reactor } from "@/components/vault/reactor";
import { getVaultState } from "@/lib/vault/data";
import { ROADMAP, titleCase } from "@/lib/vault/roadmap";

export const dynamic = "force-dynamic";

export default async function VaultHome() {
  const { metrics: m } = await getVaultState();
  const stage = ROADMAP.stages[m.currentStage - 1];
  const planned = ROADMAP.stages[m.plannedStage - 1];
  const paceClass = m.pace === "ahead" ? "is-ahead" : m.pace === "behind" ? "is-behind" : "is-on";

  return (
    <main className="fg-page">
      <header className="fg-head">
        <span className="fg-kicker"><i /> WEEK {m.week} / 48 · STAGE {String(m.currentStage).padStart(2, "0")}</span>
        <h1 className="fg-title">
          Engineering, <em>by proof.</em>
        </h1>
        <p className="fg-lede">
          The AI Engineering Field Manual as a live instrument: 13 gates, 104 concepts, 13 labs and the EvidenceOps capstone. Nothing counts on
          a demo — gate targets and test evidence score only with a link to the proof.
        </p>
      </header>

      <section className="fg-hero">
        <div className="fg-panel">
          <dl className="fg-stats">
            <div className="fg-stat">
              <dt>PACE VS PLAN</dt>
              <dd className={paceClass}>{m.driftWeeks >= 0 ? "+" : ""}{m.driftWeeks}<small>wk</small></dd>
              <span className="fg-note">{m.pace} · {Math.round(m.actualProgress * 100)}% done vs {Math.round(m.expectedProgress * 100)}% planned</span>
            </div>
            <div className="fg-stat">
              <dt>HOURS / WEEK</dt>
              <dd className={m.hours.perWeek >= m.hours.target ? "is-ahead" : m.hours.perWeek >= m.hours.target * 0.6 ? "is-on" : "is-behind"}>{m.hours.perWeek.toFixed(1)}<small>/ {m.hours.target}h</small></dd>
              <span className="fg-note">{m.hours.activeDays28}/28 active days</span>
            </div>
            <div className="fg-stat">
              <dt>GATES PASSED</dt>
              <dd>{m.stages.filter((s) => s.passed).length}<small>/13</small></dd>
              <span className="fg-note">{m.conceptCount.proven} concepts proven</span>
            </div>
            <div className="fg-stat">
              <dt>RUBRIC</dt>
              <dd className={m.rubricTotal >= 85 ? "is-ahead" : ""}>{m.rubricTotal}<small>/100</small></dd>
              <span className="fg-note">exit bar 85 (manual p.50)</span>
            </div>
          </dl>
          <Timeline m={m} />
        </div>
        <Link href={`/vault/stage/${stage.n}`} className="fg-panel" style={{ textDecoration: "none", display: "grid", gap: 10 }}>
          <span className="fg-kicker"><IconGate size={14} /> NEXT GATE · {String(stage.n).padStart(2, "0")}</span>
          <h2>{titleCase(stage.title)}</h2>
          <p className="fg-sub" style={{ margin: 0 }}>{stage.subtitle}</p>
          <ul className="fg-checks">
            {stage.gate.targets.map((t) => (
              <li key={t} className="fg-check" style={{ gridTemplateColumns: "16px 1fr" }}>
                <span style={{ color: "var(--fg-cyan)" }}>›</span>
                <span className="fg-check-body"><span>{t.replace(/\*$/, "")}</span></span>
              </li>
            ))}
          </ul>
          <span className="fg-sub" style={{ color: "var(--fg-ink-3)", fontSize: 12.5 }}>
            Proof artifact: <b style={{ color: "var(--fg-ink)" }}>{stage.proof}</b> · plan says stage {planned.n}, ends in {m.stageEndsInDays} days
          </span>
        </Link>
      </section>

      <section className="fg-sect">
        <div className="fg-sect-head">
          <h2>Proficiency core</h2>
          <span className="fg-tag">AGAINST THE WEEK-48 STANDARD · NOT YOUR PAST</span>
        </div>
        <div className="fg-panel">
          <Reactor parts={m.parts} score={m.proficiency} lever={m.lever} />
        </div>
      </section>

      <section className="fg-sect">
        <div className="fg-sect-head">
          <h2>Gate dependency map</h2>
          <span className="fg-tag">LIT BY COMPLETION · CURRENT FLOWS WHEN A TRACK IS PASSED</span>
        </div>
        <div className="fg-panel">
          <GateMap m={m} />
        </div>
      </section>

      <section className="fg-sect fg-grid g2">
        <div className="fg-panel">
          <h2>365-day heatmap</h2>
          <p className="fg-sub">Every day you logged vault work. Lime is a 4-hour day.</p>
          <CalendarHeat m={m} />
        </div>
        <div className="fg-panel">
          <h2>Cadence</h2>
          <p className="fg-sub">Your last 28 days (inside) against the manual&apos;s split (outside ring).</p>
          <CadenceRing m={m} />
        </div>
      </section>

      <section className="fg-sect fg-panel">
        <h2>48-week grid</h2>
        <p className="fg-sub">Each bar is a week of the plan, coloured by the stage scheduled for it; height is the hours you actually logged.</p>
        <WeekGrid m={m} />
      </section>

      <section className="fg-sect fg-grid g2">
        <div className="fg-panel">
          <h2>Concept mastery · 13 × 8</h2>
          <p className="fg-sub">Every concept-map box in the manual. Click one to grade it.</p>
          <ConceptMatrix m={m} />
        </div>
        <div className="fg-panel">
          <h2>Staff readiness rubric</h2>
          <p className="fg-sub">The manual&apos;s 100-point final exam, scored from gate and lab evidence in the stages that build each area.</p>
          <RubricRadar m={m} />
        </div>
      </section>

      <section className="fg-sect fg-panel">
        <h2>Benchmarks</h2>
        <p className="fg-sub">p50 and p95 latency across the artifacts you shipped.</p>
        <BenchChart m={m} />
      </section>
    </main>
  );
}
