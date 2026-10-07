"use client";

import { useMemo, useState } from "react";

import { Roll } from "@/components/su/roll";
import { NATIONAL_BASE_RATE, runModel, type Levers, type ModelInputs, type StageResult } from "@/lib/selection-model";

type LeverKey = keyof Levers;

const LEVERS: Array<{
  key: LeverKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  hint: string;
}> = [
  { key: "hoursPerDay", label: "Study hours / day", min: 0, max: 14, step: 0.25, format: (v) => `${v.toFixed(v % 1 ? 2 : 0)}h`, hint: "every calendar day, rest days included" },
  { key: "topicsPerDay", label: "Topics finished / day", min: 0, max: 30, step: 0.5, format: (v) => v.toFixed(v % 1 ? 1 : 0), hint: "ticked off the syllabus map" },
  { key: "testsPerMonth", label: "Mocks / month", min: 0, max: 16, step: 1, format: (v) => v.toFixed(0), hint: "timed, full or sectional" },
  { key: "accuracy", label: "Accuracy on attempts", min: 0.4, max: 0.98, step: 0.01, format: (v) => `${Math.round(v * 100)}%`, hint: "−⅓ mark for every wrong answer" },
  { key: "revisionPasses", label: "Revision passes", min: 0, max: 4, step: 0.5, format: (v) => v.toFixed(v % 1 ? 1 : 0), hint: "per finished topic before the exam" },
];

const PRESETS: Array<{ id: string; label: string; levers: Omit<Levers, never> | null }> = [
  { id: "you", label: "Your pace", levers: null },
  // Push-hard benchmarks: 12h a day for both, every other lever +20% (accuracy capped at the slider's 98%).
  { id: "steady", label: "Steady", levers: { hoursPerDay: 12, topicsPerDay: 9.5, testsPerMonth: 5, accuracy: 0.96, revisionPasses: 2 } },
  { id: "topper", label: "Topper routine", levers: { hoursPerDay: 12, topicsPerDay: 18, testsPerMonth: 10, accuracy: 0.98, revisionPasses: 3.5 } },
];

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/* A gate drawn as a vessel: liquid level = chance of clearing it. */
function Vessel({ stage, index, breaks }: { stage: StageResult; index: number; breaks: boolean }) {
  const level = 196 - stage.p * 188; // inner capsule spans y 8..196
  const wave = "M-80 6 Q-70 0 -60 6 T-40 6 T-20 6 T0 6 T20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 V320 H-80 Z";
  const id = `od-v-${stage.key}`;
  return (
    <figure className={`od-gate${breaks ? " is-break" : ""}`} style={{ "--gi": index } as React.CSSProperties}>
      <svg viewBox="0 0 80 204" aria-hidden="true">
        <defs>
          <clipPath id={id}>
            <rect x="6" y="6" width="68" height="192" rx="34" />
          </clipPath>
          <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="200">
            <stop className="od-g0" offset="0%" />
            <stop className="od-g1" offset="100%" />
          </linearGradient>
        </defs>
        <rect className="od-glass" x="6" y="6" width="68" height="192" rx="34" />
        <g clipPath={`url(#${id})`}>
          <g className="od-level" style={{ transform: `translateY(${level}px)` }}>
            <path className="od-wave od-wave-b" d={wave} />
            <path className="od-wave od-wave-f" d={wave} fill={`url(#${id}-g)`} />
          </g>
        </g>
        <path className="od-shine" d="M20 40 Q18 70 20 120" />
        <rect className="od-rim" x="6" y="6" width="68" height="192" rx="34" />
      </svg>
      <figcaption>
        <span className="od-gate-name">{stage.label}</span>
        <strong>
          <Roll value={stage.p * 100} decimals={0} suffix={<small>%</small>} />
        </strong>
        <span className="od-gate-note">{stage.note}</span>
      </figcaption>
    </figure>
  );
}

export function OddsEngine({ inputs, observed }: { inputs: ModelInputs; observed: Levers }) {
  const [levers, setLevers] = useState<Levers>(observed);
  const [preset, setPreset] = useState("you");
  const result = useMemo(() => runModel(inputs, levers), [inputs, levers]);
  const base = useMemo(() => runModel(inputs, observed), [inputs, observed]);
  const delta = result.overall - base.overall;
  const breakStage = result.stages.find((s) => s.key === result.breaksAt);

  const set = (key: LeverKey, value: number) => {
    setPreset("custom");
    setLevers((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="od">
      <div className="od-top">
        <div className="od-main">
          <span className="od-kicker">Chance of final selection · CSE 2027</span>
          <div className="od-figure">
            <Roll value={result.overall * 100} decimals={1} suffix={<small>%</small>} />
          </div>
          <p className="od-band">
            likely between <b>{pct(result.low)}</b> and <b>{pct(result.high)}</b>
            {preset !== "you" && Math.abs(delta) > 0.0005 ? (
              <span className={`od-delta ${delta > 0 ? "up" : "down"}`}>
                {delta > 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(1)} pts vs your pace
              </span>
            ) : null}
          </p>
          <div className="od-multiple">
            <strong>{result.multiple >= 10 ? Math.round(result.multiple) : result.multiple.toFixed(1)}×</strong>
            <span>
              the national rate of {pct(NATIONAL_BASE_RATE, 2)}
              <br />
              (≈1,000 selected of 5.5 lakh who sit Prelims)
            </span>
          </div>
          <div className="od-evidence" style={{ "--e": result.evidence } as React.CSSProperties}>
            <span>Evidence strength</span>
            <i aria-hidden="true" />
            <b>{Math.round(result.evidence * 100)}%</b>
          </div>
          <p className="od-fail">
            Failure risk <b>{pct(1 - result.overall)}</b>. If this attempt stops, it most likely stops at{" "}
            <b className="od-break">{breakStage?.label}</b>
            {result.breaksAt === "prelims" ? ` — ${result.projectedPrelimsScore}/200 projected against a ~${result.cutoffScore} cut-off.` : "."}
          </p>
        </div>

        <div className="od-gates" aria-label="Chance of clearing each stage">
          {result.stages.map((stage, i) => (
            <div className="od-gate-wrap" key={stage.key}>
              {i > 0 ? <span className="od-op" aria-hidden="true">×</span> : null}
              <Vessel stage={stage} index={i} breaks={stage.key === result.breaksAt} />
            </div>
          ))}
        </div>
      </div>

      <div className="od-levers">
        <div className="od-levers-head">
          <div>
            <span className="od-kicker">What if</span>
            <h3>Move the levers, watch the odds</h3>
          </div>
          <div className="su-seg" style={{ "--n": PRESETS.length, "--i": Math.max(0, PRESETS.findIndex((p) => p.id === preset)) } as React.CSSProperties}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={preset === p.id}
                onClick={() => {
                  setPreset(p.id);
                  setLevers(p.levers ?? observed);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="od-sliders">
          {LEVERS.map((lever) => {
            const value = levers[lever.key];
            const fill = (value - lever.min) / (lever.max - lever.min);
            const mark = (observed[lever.key] - lever.min) / (lever.max - lever.min);
            return (
              <label key={lever.key} className="od-slider" style={{ "--fill": fill, "--mark": Math.min(1, Math.max(0, mark)) } as React.CSSProperties}>
                <span className="od-slider-top">
                  <span>{lever.label}</span>
                  <b>{lever.format(value)}</b>
                </span>
                <span className="od-track">
                  <input
                    type="range"
                    min={lever.min}
                    max={lever.max}
                    step={lever.step}
                    value={value}
                    onChange={(e) => set(lever.key, Number(e.target.value))}
                    aria-valuetext={lever.format(value)}
                  />
                  <i className="od-mark" title={`Your pace: ${lever.format(observed[lever.key])}`} aria-hidden="true" />
                </span>
                <span className="od-slider-hint">
                  {lever.hint} · you: {lever.format(observed[lever.key])}
                </span>
              </label>
            );
          })}
        </div>

        <dl className="od-proj">
          <div>
            <dt>Projected Prelims GS</dt>
            <dd>
              <Roll value={result.projectedPrelimsScore} />
              <small>/200 · cut-off ~{result.cutoffScore}</small>
            </dd>
          </div>
          <div>
            <dt>Syllabus covered by Prelims</dt>
            <dd>
              <Roll value={result.coverageAtPrelims * 100} />
              <small>%</small>
            </dd>
          </div>
          <div>
            <dt>Hours banked by Prelims</dt>
            <dd>
              <Roll value={result.hoursAtPrelims} />
              <small>h</small>
            </dd>
          </div>
          <div>
            <dt>Mains gate</dt>
            <dd>
              <Roll value={result.stages[1].p * 100} />
              <small>%</small>
            </dd>
          </div>
        </dl>

        <details className="od-how">
          <summary>How this is estimated</summary>
          <p>
            Three gates, multiplied. <b>Prelims</b> blends your recency-weighted test execution (attempt rate × accuracy
            with −⅓ negative marking, discounted when tests cover few subjects) with a preparation estimate (syllabus
            coverage at exam day × retention from revision, plus hours banked against a ~2,200 h first pass). That is
            compared with a ~90/200 cut-off on a bell curve whose width shrinks as you log more tests. CSAT is assumed
            to clear unless your CSAT scores say otherwise. <b>Mains</b> starts from the ~20% of Mains candidates who
            reach interview and moves with coverage, answer-writing evidence and hours. <b>Interview</b> stays near its
            ~36% base rate, nudged by logged confidence. Evidence strength sets the band. It is a planning instrument,
            not a prophecy — the levers show which habits move it most.
          </p>
        </details>
      </div>
    </div>
  );
}
