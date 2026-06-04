"use client";

import { useState, useTransition } from "react";
import { Sparkles, RefreshCw, AlertTriangle, Flame, BookMarked, Compass, ShieldCheck, Target, Smartphone } from "lucide-react";

import { generateGoalsInsightAction, type GoalsInsight } from "@/app/goals/actions";

const VERDICT_TONE: Record<string, { color: string; label: string }> = {
  PEAK: { color: "hsl(38, 96%, 60%)", label: "Peak momentum" },
  STRONG: { color: "hsl(168, 70%, 54%)", label: "Strong momentum" },
  BUILDING: { color: "hsl(199, 78%, 60%)", label: "Building" },
  DRIFTING: { color: "hsl(28, 92%, 60%)", label: "Drifting" },
  STALLED: { color: "var(--danger)", label: "Stalled" },
};

const PRIORITY_TONE: Record<string, string> = {
  HIGH: "var(--danger)",
  MEDIUM: "hsl(38, 92%, 62%)",
  LOW: "hsl(199, 78%, 62%)",
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
    <article className="glass panel goals-suggest-panel">
      <div className="goals-panel-head">
        <div>
          <div className="eyebrow">AI revision radar</div>
          <div className="display goals-panel-title">What to revise next</div>
        </div>
        <button type="button" className="goals-suggest-trigger" onClick={run} disabled={pending}>
          {pending ? <RefreshCw size={15} className="spin" /> : <Sparkles size={15} />}
          {pending ? "Analysing…" : insight ? "Re-run" : "Run deep analysis"}
        </button>
      </div>

      {!insight && !pending && (
        <div className="goals-suggest-empty">
          <Sparkles size={26} />
          <p>
            Run a one-shot scan across your hours, revision history, weak subjects and stale topics. The model only fires
            when you ask — it reads <b>all</b> your data and tells you exactly what is decaying and what to pick up next.
          </p>
        </div>
      )}

      {pending && (
        <div className="goals-suggest-loading">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="goals-suggest-skeleton" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      )}

      {insight && !pending && (
        <div className="goals-suggest-body">
          {/* Deterministic momentum band — always shown, even if AI failed */}
          {m && (
            <div className="goals-momentum-band">
              <div className="goals-momentum-score" style={{ "--mo-color": verdict?.color } as React.CSSProperties}>
                <svg viewBox="0 0 100 100" width={92} height={92}>
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
                  <circle
                    cx="50" cy="50" r="42" fill="none" stroke={verdict?.color} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - m.momentumScore / 100)}
                    transform="rotate(-90 50 50)"
                    style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.32,0.72,0,1)" }}
                  />
                </svg>
                <div className="goals-momentum-score-label">
                  <strong>{m.momentumScore}</strong>
                  <span>{verdict?.label}</span>
                </div>
              </div>
              <div className="goals-momentum-stats">
                <div><strong>{m.avgHours}h</strong><span>avg / day</span></div>
                <div><strong style={{ color: "hsl(148,62%,56%)" }}>{m.goodDays}</strong><span>8h+ days</span></div>
                <div><strong style={{ color: "hsl(38,96%,62%)" }}>{m.peakDays}</strong><span>12h+ days</span></div>
                <div><strong style={{ color: m.belowParDays > m.goodDays ? "var(--danger)" : "var(--text)" }}>{m.belowParDays}</strong><span>sub-8h days</span></div>
                <div><strong>{m.consistencyPct}%</strong><span>good-day rate</span></div>
                <div><strong style={{ color: "var(--danger)" }}>{m.hoursDebt}h</strong><span>hours debt</span></div>
              </div>
            </div>
          )}

          {insight.distraction && (
            <div className={`goals-distraction-band tone-${insight.distraction.verdict.toLowerCase()}`}>
              <div className="goals-distraction-icon">
                <Smartphone size={18} />
              </div>
              <div className="goals-distraction-body">
                <div className="goals-distraction-head">
                  <strong>Distraction: {insight.distraction.verdict.replace(/_/g, " ")}</strong>
                  <span>{insight.distraction.avgPerDay}h / day avg</span>
                </div>
                <div className="goals-distraction-stats">
                  {insight.distraction.topApp && (
                    <span>Top sink · <b>{insight.distraction.topApp}</b> ({insight.distraction.topAppHours}h)</span>
                  )}
                  <span>{insight.distraction.highDays} heavy days (3h+)</span>
                  <span>Study YT · <b style={{ color: "hsl(148,62%,56%)" }}>{insight.distraction.studyYouTube}h</b></span>
                  {insight.distraction.onLowStudyDays > 0 && (
                    <span>
                      On sub-8h days you scroll <b style={{ color: "var(--danger)" }}>{insight.distraction.onLowStudyDays}h</b> vs{" "}
                      {insight.distraction.onGoodStudyDays}h on good days
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {insight.ai?.distractionVerdict ? (
            <div className="goals-suggest-scold">
              <Smartphone size={15} />
              <p>{insight.ai.distractionVerdict}</p>
            </div>
          ) : null}

          {insight.error && !insight.ai && (
            <div className="goals-suggest-error">
              <AlertTriangle size={16} />
              {insight.error} The momentum read and stale-area list above are computed locally and stay accurate.
            </div>
          )}

          {insight.ai && (
            <>
              <div className="goals-suggest-headline">
                <Flame size={16} />
                <p>{insight.ai.headline}</p>
              </div>
              <p className="goals-suggest-momentum-read">{insight.ai.momentumRead}</p>

              <div className="goals-suggest-cols">
                <section className="goals-suggest-col">
                  <h4><BookMarked size={14} /> Revise now</h4>
                  <ul>
                    {insight.ai.reviseNow?.map((r, i) => (
                      <li key={i} style={{ "--p-tone": PRIORITY_TONE[r.priority] ?? "var(--text-muted)" } as React.CSSProperties}>
                        <div className="goals-suggest-li-head">
                          <span className="goals-suggest-dot" />
                          <strong>{r.area}</strong>
                          <em>{r.priority}</em>
                        </div>
                        <p>{r.reason}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="goals-suggest-col">
                  <h4><Compass size={14} /> Study next</h4>
                  <ul>
                    {insight.ai.studyNext?.map((s, i) => (
                      <li key={i} style={{ "--p-tone": "hsl(199,78%,62%)" } as React.CSSProperties}>
                        <div className="goals-suggest-li-head">
                          <span className="goals-suggest-dot" />
                          <strong>{s.area}</strong>
                        </div>
                        <p>{s.reason}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              {insight.ai.habitFix && (
                <div className="goals-suggest-habit">
                  <div className="goals-suggest-habit-card good">
                    <ShieldCheck size={15} />
                    <div><span>Protect</span><p>{insight.ai.habitFix.strength}</p></div>
                  </div>
                  <div className="goals-suggest-habit-card fix">
                    <Target size={15} />
                    <div><span>Fix</span><p>{insight.ai.habitFix.fix}</p></div>
                  </div>
                </div>
              )}

              {insight.ai.weeklyTargets?.length > 0 && (
                <div className="goals-suggest-targets">
                  {insight.ai.weeklyTargets.map((t, i) => (
                    <div key={i} className="goals-suggest-target">
                      <span>{t.label}</span>
                      <strong>{t.target}</strong>
                    </div>
                  ))}
                </div>
              )}

              {insight.ai.closingNote && <p className="goals-suggest-close">{insight.ai.closingNote}</p>}
            </>
          )}

          {/* Deterministic stale areas — always available */}
          {insight.computedStale.length > 0 && (
            <details className="goals-suggest-stale" open={!insight.ai}>
              <summary>Detected stale &amp; neglected zones ({insight.computedStale.length})</summary>
              <div className="goals-suggest-stale-list">
                {insight.computedStale.map((s, i) => (
                  <div key={i} className="goals-suggest-stale-item" style={{ "--p-tone": PRIORITY_TONE[s.priority] } as React.CSSProperties}>
                    <div className="goals-suggest-stale-top">
                      <strong>{s.area}</strong>
                      <em>{s.priority}</em>
                    </div>
                    <span>{s.signal} · {s.lastTouched}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="goals-suggest-meta">
            Generated {new Date(insight.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            {insight.model !== "none" ? ` · ${insight.model}` : ""}
          </div>
        </div>
      )}
    </article>
  );
}
