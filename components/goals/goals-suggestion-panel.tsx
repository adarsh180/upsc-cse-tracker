"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { AlertTriangle, BookMarked, Compass, Flame, RefreshCw, ShieldCheck, Smartphone, Target } from "lucide-react";

import { generateGoalsInsightAction, type GoalsInsight } from "@/app/goals/actions";

const VERDICT_TONE: Record<string, { color: string; label: string }> = {
  PEAK: { color: "var(--g-peak)", label: "Peak momentum" },
  STRONG: { color: "var(--g-strong)", label: "Strong momentum" },
  BUILDING: { color: "var(--nv-a2)", label: "Building" },
  DRIFTING: { color: "var(--g-warn)", label: "Drifting" },
  STALLED: { color: "var(--nv-rose)", label: "Stalled" },
};

const PRIORITY_TONE: Record<string, string> = {
  HIGH: "var(--nv-rose)",
  MEDIUM: "var(--g-warn)",
  LOW: "var(--nv-a2)",
};

export function GoalsSuggestionPanel() {
  const [insight, setInsight] = useState<GoalsInsight | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    startTransition(async () => {
      try {
        const result = await generateGoalsInsightAction();
        setInsight(result);
      } catch (e) {
        setInsight({
          metrics: null as never,
          distraction: null,
          computedStale: [],
          ai: null,
          model: "none",
          generatedAt: new Date().toISOString(),
          error: e instanceof Error ? e.message : "Could not run analysis.",
        });
      }
    });
  };

  const m = insight?.metrics;
  const verdict = m ? VERDICT_TONE[m.momentumVerdict] : null;


  return (
    <article className="gs" data-state={pending ? "loading" : insight ? "ready" : "idle"}>
      <header className="gs-head">
        <p>
          An on-demand read across hours, stale subjects, weak revision zones and distraction debt. Nothing runs until you
          ask.
        </p>
        <button type="button" className="lg-btn save gs-run" onClick={run} disabled={pending}>
          {pending ? <RefreshCw size={15} className="gs-spin" /> : <Compass size={15} />}
          {pending ? "Reading your data…" : insight ? "Refresh brief" : "Generate brief"}
        </button>
      </header>

      {!insight && !pending ? (
        <ol className="gs-checks">
          {[
            ["Momentum", "Average hours, 8h+ and 12h+ days, hours debt"],
            ["Staleness", "Subjects you haven't tagged in 10+ days"],
            ["Revision", "Least-revised and weakest areas"],
            ["Attention", "Distraction on low vs good study days"],
          ].map(([title, desc], i) => (
            <li key={title}>
              <span className="nv-mono">0{i + 1}</span>
              <b>{title}</b>
              <small>{desc}</small>
            </li>
          ))}
        </ol>
      ) : null}

      {pending ? (
        <div className="gs-loading" aria-label="Analysing">
          {[92, 74, 86, 58, 80].map((w, i) => (
            <span key={i} style={{ width: `${w}%`, animationDelay: `${i * 110}ms` }} />
          ))}
        </div>
      ) : null}

      {insight && !pending ? (
        <div className="gs-body">
          {m ? (
            <div className="gs-momentum" style={{ "--mo": verdict?.color } as CSSProperties}>
              <div className="gs-dial">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r="42" className="gs-dial-track" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    className="gs-dial-fill"
                    pathLength={100}
                    style={{ strokeDashoffset: 100 - m.momentumScore } as CSSProperties}
                  />
                </svg>
                <div>
                  <strong>{m.momentumScore}</strong>
                  <span>{verdict?.label}</span>
                </div>
              </div>
              <dl className="gs-stats">
                <div>
                  <dt>Avg / day</dt>
                  <dd>{m.avgHours}h</dd>
                </div>
                <div className="is-good">
                  <dt>8h+ days</dt>
                  <dd>{m.goodDays}</dd>
                </div>
                <div className="is-peak">
                  <dt>12h+ days</dt>
                  <dd>{m.peakDays}</dd>
                </div>
                <div className={m.belowParDays > m.goodDays ? "is-bad" : ""}>
                  <dt>Sub-8h days</dt>
                  <dd>{m.belowParDays}</dd>
                </div>
                <div>
                  <dt>Good-day rate</dt>
                  <dd>{m.consistencyPct}%</dd>
                </div>
                <div className="is-bad">
                  <dt>Hours debt</dt>
                  <dd>{m.hoursDebt}h</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {insight.distraction ? (
            <div className={`gs-attention v-${insight.distraction.verdict.toLowerCase()}`}>
              <Smartphone size={17} />
              <div>
                <strong>
                  Attention: {insight.distraction.verdict.replace(/_/g, " ").toLowerCase()}
                  <span>{insight.distraction.avgPerDay}h / day</span>
                </strong>
                <p>
                  {insight.distraction.topApp ? (
                    <>
                      Top sink <b>{insight.distraction.topApp}</b> ({insight.distraction.topAppHours}h) ·{" "}
                    </>
                  ) : null}
                  {insight.distraction.highDays} heavy days (3h+) · study YouTube{" "}
                  <b className="is-good">{insight.distraction.studyYouTube}h</b>
                  {insight.distraction.onLowStudyDays > 0 ? (
                    <>
                      {" "}
                      · on sub-8h days you scroll <b className="is-bad">{insight.distraction.onLowStudyDays}h</b> vs{" "}
                      {insight.distraction.onGoodStudyDays}h on good days
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          ) : null}

          {insight.ai?.distractionVerdict ? <p className="gs-scold">{insight.ai.distractionVerdict}</p> : null}

          {insight.error && !insight.ai ? (
            <div className="gs-error">
              <AlertTriangle size={16} />
              {insight.error} The momentum read and stale-area list are computed locally and stay accurate.
            </div>
          ) : null}

          {insight.ai ? (
            <>
              <blockquote className="gs-headline">
                <Flame size={16} />
                <p>{insight.ai.headline}</p>
              </blockquote>
              <p className="gs-read">{insight.ai.momentumRead}</p>

              <div className="gs-cols">
                <section>
                  <h4>
                    <BookMarked size={14} /> Revise now
                  </h4>
                  <ol>
                    {insight.ai.reviseNow?.map((r, i) => (
                      <li key={`${r.area}-${i}`} style={{ "--p": PRIORITY_TONE[r.priority] ?? "var(--nv-faint)" } as CSSProperties}>
                        <div>
                          <strong>{r.area}</strong>
                          <em>{r.priority}</em>
                        </div>
                        <p>{r.reason}</p>
                      </li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h4>
                    <Compass size={14} /> Study next
                  </h4>
                  <ol>
                    {insight.ai.studyNext?.map((s, i) => (
                      <li key={`${s.area}-${i}`} style={{ "--p": "var(--nv-a2)" } as CSSProperties}>
                        <div>
                          <strong>{s.area}</strong>
                        </div>
                        <p>{s.reason}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              {insight.ai.habitFix ? (
                <div className="gs-habit">
                  <div className="is-keep">
                    <ShieldCheck size={15} />
                    <div>
                      <span>Protect</span>
                      <p>{insight.ai.habitFix.strength}</p>
                    </div>
                  </div>
                  <div className="is-fix">
                    <Target size={15} />
                    <div>
                      <span>Fix</span>
                      <p>{insight.ai.habitFix.fix}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {insight.ai.weeklyTargets?.length > 0 ? (
                <dl className="gs-targets">
                  {insight.ai.weeklyTargets.map((t, i) => (
                    <div key={`${t.label}-${i}`}>
                      <dt>{t.label}</dt>
                      <dd>{t.target}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              {insight.ai.closingNote ? <p className="gs-close">{insight.ai.closingNote}</p> : null}
            </>
          ) : null}

          {insight.computedStale.length > 0 ? (
            <details className="gs-stale" open={!insight.ai}>
              <summary>
                Stale and neglected zones <span className="nv-mono">{insight.computedStale.length}</span>
              </summary>
              <div className="gs-stale-list">
                {insight.computedStale.map((s, i) => (
                  <div key={`${s.area}-${i}`} style={{ "--p": PRIORITY_TONE[s.priority] } as CSSProperties}>
                    <strong>{s.area}</strong>
                    <em>{s.priority}</em>
                    <span>
                      {s.signal} · {s.lastTouched}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <p className="gs-meta nv-mono">
            {new Date(insight.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            {insight.model !== "none" ? ` · ${insight.model}` : ""}
          </p>
        </div>
      ) : null}
    </article>
  );
}
