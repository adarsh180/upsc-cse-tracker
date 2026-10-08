"use client";

import { useMemo, useState, type CSSProperties } from "react";

import { BASE_HOURS, runWhatIf } from "@/lib/vault/what-if";
import { ROADMAP, TOTAL_WEEKS } from "@/lib/vault/roadmap";

type Levers = { hoursPerWeek: number; cadenceFit: number; reworkRate: number };

const PRESETS: Array<{ id: string; label: string; levers: Levers | null }> = [
  { id: "you", label: "Your pace", levers: null },
  { id: "steady", label: "Steady", levers: { hoursPerWeek: 21, cadenceFit: 0.9, reworkRate: 0.25 } },
  { id: "push", label: "Push hard", levers: { hoursPerWeek: 30, cadenceFit: 0.96, reworkRate: 0.15 } },
];

export function WhatIfSim({ observed, weeksElapsed, stageScores }: { observed: Levers; weeksElapsed: number; stageScores: number[] }) {
  const [levers, setLevers] = useState<Levers>(observed);
  const [preset, setPreset] = useState("you");
  const r = useMemo(() => runWhatIf(levers, { weeksElapsed, stageScores }), [levers, weeksElapsed, stageScores]);
  const span = Math.max(TOTAL_WEEKS, Math.ceil(r.finishWeek) + 2);
  const set = (k: keyof Levers, v: number) => {
    setPreset("custom");
    setLevers((l) => ({ ...l, [k]: v }));
  };

  return (
    <div className="fg-grid g2">
      <div className="fg-panel">
        <div className="fg-sect-head" style={{ marginBottom: 14 }}>
          <h2>Levers</h2>
          <div style={{ display: "flex", gap: 6 }}>
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className={`fg-btn is-sm ${preset === p.id ? "is-primary" : ""}`} onClick={() => { setPreset(p.id); setLevers(p.levers ?? observed); }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="fg-levers">
          <label className="fg-lever-row">
            <header><b>Focused hours a week</b><span>{levers.hoursPerWeek.toFixed(1)}h</span></header>
            <input type="range" min={0} max={45} step={0.5} value={levers.hoursPerWeek} onChange={(e) => set("hoursPerWeek", Number(e.target.value))} />
            <small>The manual is sized for ~{BASE_HOURS}h (its 15–20h band).</small>
          </label>
          <label className="fg-lever-row">
            <header><b>Cadence discipline</b><span>{Math.round(levers.cadenceFit * 100)}%</span></header>
            <input type="range" min={0} max={1} step={0.01} value={levers.cadenceFit} onChange={(e) => set("cadenceFit", Number(e.target.value))} />
            <small>How closely you hold 20/55/15/10 — skipped breaking and review cost rework later.</small>
          </label>
          <label className="fg-lever-row">
            <header><b>Gate rework rate</b><span>{Math.round(levers.reworkRate * 100)}%</span></header>
            <input type="range" min={0} max={1} step={0.01} value={levers.reworkRate} onChange={(e) => set("reworkRate", Number(e.target.value))} />
            <small>Share of gates that fail review the first time and need another pass.</small>
          </label>
        </div>
      </div>

      <div className="fg-panel">
        <h2>Projection</h2>
        <dl className="fg-proj" style={{ marginTop: 12 }}>
          <div><dt>FINISH WEEK</dt><dd className={r.finishWeek <= TOTAL_WEEKS ? "is-ahead" : "is-behind"}>{r.finishWeek > 200 ? "200+" : r.finishWeek}</dd></div>
          <div><dt>VS WEEK 48</dt><dd className={r.slipWeeks <= 0 ? "is-ahead" : "is-behind"}>{r.slipWeeks > 0 ? "+" : ""}{r.slipWeeks > 150 ? "150+" : r.slipWeeks}<small style={{ fontSize: "0.45em" }}>wk</small></dd></div>
          <div><dt>DONE BY WEEK 48</dt><dd>{Math.round(r.progressAt48 * 100)}%</dd></div>
        </dl>
        <p className="fg-sub" style={{ marginTop: 12 }}>Pace {r.pace.toFixed(2)}× the manual. Grey is the plan, cyan your projection; the line marks week 48.</p>
        <div className="fg-gantt">
          {r.stageFinish.map((sf, i) => {
            const st = ROADMAP.stages[i];
            const prevEnd = i === 0 ? weeksElapsed : Math.max(weeksElapsed, r.stageFinish[i - 1].projected);
            const late = sf.projected > st.weeks[1];
            return (
              <div key={sf.n} className="fg-gantt-row">
                <span>S{String(sf.n).padStart(2, "0")}</span>
                <span className="bar" style={{ "--span": span } as CSSProperties}>
                  <i className="plan" style={{ left: `${((st.weeks[0] - 1) / span) * 100}%`, width: `${((st.weeks[1] - st.weeks[0] + 1) / span) * 100}%` }} />
                  <i className={`proj ${late ? "is-late" : ""}`} style={{ left: `${(prevEnd / span) * 100}%`, width: `${Math.max(0.4, ((sf.projected - prevEnd) / span) * 100)}%`, height: 4, top: 3 }} />
                  <i className="wall" style={{ left: `${(TOTAL_WEEKS / span) * 100}%` }} />
                </span>
                <span style={{ textAlign: "right" }}>wk {sf.projected > 200 ? "200+" : Math.round(sf.projected)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
