import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { StageBoard } from "@/components/vault/stage-board";
import { getVaultState } from "@/lib/vault/data";
import { ROADMAP, titleCase } from "@/lib/vault/roadmap";

export const dynamic = "force-dynamic";

export default async function StagePage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const num = Number(n);
  const stage = ROADMAP.stages.find((s) => s.n === num);
  if (!stage) notFound();
  const { metrics: m, records } = await getVaultState();
  const sc = m.stages[num - 1];
  const prefix = `s${num}.`;
  const initial = Object.fromEntries(
    records.progress.filter((p) => p.itemKey.startsWith(prefix)).map((p) => [p.itemKey, { status: p.status, evidenceUrl: p.evidenceUrl, note: p.note }]),
  );
  const hours = Math.round((sc.minutes / 60) * 10) / 10;

  return (
    <main className="fg-page">
      <nav className="fg-stagebar" aria-label="Gates">
        {ROADMAP.stages.map((s) => (
          <Link
            key={s.n}
            href={`/vault/stage/${s.n}`}
            aria-current={s.n === num ? "page" : undefined}
            className={m.stages[s.n - 1].passed ? "is-passed" : ""}
            style={{ "--s": m.stages[s.n - 1].score } as CSSProperties}
            title={titleCase(s.title)}
          >
            <span>{String(s.n).padStart(2, "0")}</span>
          </Link>
        ))}
      </nav>

      <header className="fg-head">
        <span className="fg-kicker"><i /> GATE {String(num).padStart(2, "0")} · WEEKS {stage.weeks[0]}–{stage.weeks[1]} · {stage.panel}</span>
        <h1 className="fg-title">{titleCase(stage.title)}</h1>
        <p className="fg-lede">{stage.subtitle}. <b style={{ color: "var(--fg-ink)" }}>Readiness check:</b> {stage.readiness}</p>
        <dl className="fg-stats" style={{ marginTop: 10 }}>
          <div className="fg-stat"><dt>STAGE SCORE</dt><dd className={sc.passed ? "is-ahead" : ""}>{Math.round(sc.score * 100)}<small>%</small></dd><span className="fg-note">{sc.passed ? "gate passed" : "gate open"}</span></div>
          <div className="fg-stat"><dt>CONCEPTS</dt><dd>{Math.round(sc.concept * 100)}<small>%</small></dd><span className="fg-note">mastery</span></div>
          <div className="fg-stat"><dt>LAB</dt><dd>{Math.round(sc.lab * 100)}<small>%</small></dd><span className="fg-note">components + milestones</span></div>
          <div className="fg-stat"><dt>TIME HERE</dt><dd>{hours}<small>h</small></dd><span className="fg-note">plan ≈ {(stage.weeks[1] - stage.weeks[0] + 1) * 17.5}h</span></div>
        </dl>
      </header>

      <StageBoard stage={stage} initial={initial} />
    </main>
  );
}
