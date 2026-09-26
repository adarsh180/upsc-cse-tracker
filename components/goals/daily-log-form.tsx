"use client";

import {
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, Save } from "lucide-react";

import { saveDailyGoalAction } from "@/app/actions";
import { MOMENTUM_TIERS, tierForHours } from "@/components/goals/momentum-tiers";
import { SubjectTagPicker, type SubjectGroup } from "@/components/goals/subject-tag-picker";

export type DailyLogDefaults = {
  logDate: string;
  primaryFocus: string;
  totalHours: number;
  completion: number;
  disciplineScore: number;
  questionsSolved: number;
  topicsStudied: number;
  wins: string;
  blockers: string;
  tomorrowPlan: string;
};

type StepKey = "mission" | "coverage" | "numbers" | "reflect";

const STEPS: { key: StepKey; label: string; hint: string }[] = [
  { key: "mission", label: "Brief", hint: "Date & mission" },
  { key: "coverage", label: "Coverage", hint: "Syllabus touched" },
  { key: "numbers", label: "Numbers", hint: "Hours & output" },
  { key: "reflect", label: "Reflect", hint: "Wins & repair" },
];

const HOUR_MAX = 16;
const MISSION_LIMIT = 120;

function clampNum(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function formatHours(value: number) {
  if (!value) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

export function DailyLogForm({
  todayKey,
  todayLabel,
  subjectGroups,
  defaultSubjects = [],
  defaults,
  hasTodayLog = false,
}: {
  todayKey: string;
  todayLabel: string;
  subjectGroups: SubjectGroup[];
  defaultSubjects?: string[];
  defaults: DailyLogDefaults;
  hasTodayLog?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logDate, setLogDate] = useState(defaults.logDate || todayKey);
  const [primaryFocus, setPrimaryFocus] = useState(defaults.primaryFocus);
  const [totalHours, setTotalHours] = useState(defaults.totalHours || 0);
  const [completion, setCompletion] = useState(defaults.completion || 0);
  const [disciplineScore, setDisciplineScore] = useState(defaults.disciplineScore || 0);
  const [questionsSolved, setQuestionsSolved] = useState(defaults.questionsSolved || 0);
  const [topicsStudied, setTopicsStudied] = useState(defaults.topicsStudied || 0);
  const [wins, setWins] = useState(defaults.wins);
  const [blockers, setBlockers] = useState(defaults.blockers);
  const [tomorrowPlan, setTomorrowPlan] = useState(defaults.tomorrowPlan);

  const tier = tierForHours(totalHours);
  const tierMeta = MOMENTUM_TIERS[tier];
  const isGood = totalHours >= 8;
  const isPeak = totalHours >= 12;
  const hoursToGood = Math.max(0, 8 - totalHours);

  const verdict = useMemo(() => {
    if (totalHours <= 0) return "Open ledger — start with the honest number.";
    if (isPeak) return "Peak attempt mode. This is the day that builds rank.";
    if (isGood) return "Good day cleared. The 12h ceiling is the next line.";
    if (totalHours >= 6) return `Close — ${formatHours(hoursToGood)}h more crosses the good-day bar.`;
    return `Below the 8h bar by ${formatHours(hoursToGood)}h. Tomorrow needs correction.`;
  }, [totalHours, isGood, isPeak, hoursToGood]);

  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!logDate) return "Pick the log date first.";
      if (!primaryFocus.trim()) return "Name the mission objective for today.";
    }
    return null;
  };

  const goTo = (next: number) => {
    setDir(next >= step ? "fwd" : "back");
    setStep(next);
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    goTo(Math.min(STEPS.length - 1, step + 1));
  };

  const goBack = () => {
    setError(null);
    goTo(Math.max(0, step - 1));
  };

  const blockEnterSubmit = (event: KeyboardEvent<HTMLFormElement>) => {
    const target = event.target as HTMLElement;
    if (event.key === "Enter" && target.tagName !== "TEXTAREA" && target.getAttribute("type") !== "submit") {
      event.preventDefault();
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    for (let i = 0; i < STEPS.length; i += 1) {
      const err = validateStep(i);
      if (err) {
        goTo(i);
        setError(err);
        return;
      }
    }
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await saveDailyGoalAction(formData);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2600);
    });
  };

  const score = Math.round(
    Math.min(
      100,
      totalHours * 5 + completion * 0.28 + disciplineScore * 0.22 + Math.min(questionsSolved, 100) * 0.1,
    ),
  );

  const hourPct = clampNum((totalHours / HOUR_MAX) * 100, 0, 100);

  return (
    <article
      className="lg-form"
      style={{ "--tier": tier === 0 ? "var(--nv-faint)" : tierMeta.accent, "--step": step, "--steps": STEPS.length } as CSSProperties}
    >
      <header className="lg-form-head">
        <div>
          <span className="lg-eyebrow">Closeout · {todayLabel}</span>
          <h3>Close today&apos;s ledger</h3>
        </div>
        {hasTodayLog ? (
          <span className="lg-pill is-live">
            <Check size={12} /> Editing today
          </span>
        ) : (
          <span className="lg-pill">New entry</span>
        )}
      </header>

      {/* Live readout — reacts to every number typed below */}
      <div className={`lg-readout${isPeak ? " is-peak" : isGood ? " is-good" : ""}`} aria-live="polite">
        <div className="lg-readout-figure">
          <span className="lg-readout-emoji" key={tier} aria-hidden="true">
            {tier === 0 ? "—" : tierMeta.emoji}
          </span>
          <strong>{formatHours(totalHours)}</strong>
          <em>h</em>
        </div>
        <div className="lg-readout-body">
          <div className="lg-readout-line">
            <b>{tierMeta.label}</b>
            <span>{verdict}</span>
          </div>
          <div className="lg-scale" aria-hidden="true">
            <div className="lg-scale-track">
              <i style={{ width: `${hourPct}%` }} />
            </div>
            <span className="lg-scale-mark good" style={{ left: `${(8 / HOUR_MAX) * 100}%` }}>8h</span>
            <span className="lg-scale-mark peak" style={{ left: `${(12 / HOUR_MAX) * 100}%` }}>12h</span>
          </div>
        </div>
        <dl className="lg-readout-stats">
          <div>
            <dt>Score</dt>
            <dd>{score}</dd>
          </div>
          <div>
            <dt>Done</dt>
            <dd>{completion}%</dd>
          </div>
          <div>
            <dt>Disc.</dt>
            <dd>{disciplineScore}</dd>
          </div>
          <div>
            <dt>Qs</dt>
            <dd>{questionsSolved}</dd>
          </div>
        </dl>
      </div>

      <div className="lg-steps" role="tablist" aria-label="Logging steps">
        {STEPS.map((s, i) => (
          <button
            type="button"
            key={s.key}
            role="tab"
            aria-selected={i === step}
            className={`lg-step${i === step ? " is-on" : ""}${i < step ? " is-done" : ""}`}
            onClick={() => {
              const err = validateStep(Math.min(step, i));
              if (i > step && err) {
                setError(err);
                return;
              }
              setError(null);
              goTo(i);
            }}
          >
            <span className="lg-step-num">{i < step ? <Check size={11} strokeWidth={3} /> : `0${i + 1}`}</span>
            <span className="lg-step-text">
              <b>{s.label}</b>
              <small>{s.hint}</small>
            </span>
          </button>
        ))}
        <span className="lg-steps-rail" aria-hidden="true">
          <i />
        </span>
      </div>

      <form onSubmit={submit} onKeyDown={blockEnterSubmit} className="lg-body">
        <input type="hidden" name="logDate" value={logDate} />
        <input type="hidden" name="totalHours" value={totalHours} />
        <input type="hidden" name="completion" value={completion} />
        <input type="hidden" name="disciplineScore" value={disciplineScore} />
        <input type="hidden" name="questionsSolved" value={questionsSolved} />
        <input type="hidden" name="topicsStudied" value={topicsStudied} />

        <div className="lg-stage" data-dir={dir}>
          {/* 01 — Brief */}
          <section className={`lg-panel${step === 0 ? " is-on" : ""}`} aria-hidden={step !== 0}>
            <div className="lg-brief">
              <label className="lg-field lg-field-date">
                <span className="lg-label">Log date</span>
                <input
                  className="lg-input"
                  type="date"
                  value={logDate}
                  max={todayKey}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </label>
              <label className="lg-field lg-field-mission">
                <span className="lg-label">
                  Mission objective
                  <em>{primaryFocus.length}/{MISSION_LIMIT}</em>
                </span>
                <input
                  className="lg-input lg-input-hero"
                  name="primaryFocus"
                  value={primaryFocus}
                  maxLength={MISSION_LIMIT}
                  onChange={(e) => setPrimaryFocus(e.target.value)}
                  placeholder="Polity: DPSP revision + 40 PYQs"
                />
                <small className="lg-help">One sharp line. What was today supposed to accomplish?</small>
              </label>
            </div>
          </section>

          {/* 02 — Coverage */}
          <section className={`lg-panel${step === 1 ? " is-on" : ""}`} aria-hidden={step !== 1}>
            {subjectGroups.length > 0 ? (
              <SubjectTagPicker groups={subjectGroups} defaultSelected={defaultSubjects} />
            ) : (
              <div className="lg-empty">No syllabus subjects found yet. You can still log everything else.</div>
            )}
          </section>

          {/* 03 — Numbers */}
          <section className={`lg-panel${step === 2 ? " is-on" : ""}`} aria-hidden={step !== 2}>
            <div className="lg-numbers">
              <div className="lg-hours">
                <div className="lg-hours-head">
                  <span className="lg-label">Deep-work hours</span>
                  <span className="lg-hours-rule">8h good · 12h peak</span>
                </div>
                <div className="lg-hours-control">
                  <button
                    type="button"
                    className="lg-round"
                    onClick={() => setTotalHours((h) => clampNum(Number((h - 0.25).toFixed(2)), 0, 24))}
                    aria-label="Decrease hours"
                  >
                    <Minus size={17} />
                  </button>
                  <label className="lg-hours-value">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      inputMode="decimal"
                      value={totalHours || ""}
                      onChange={(e) => setTotalHours(clampNum(Number(e.target.value), 0, 24))}
                      placeholder="0"
                      aria-label="Deep-work hours"
                    />
                    <span>hours</span>
                  </label>
                  <button
                    type="button"
                    className="lg-round"
                    onClick={() => setTotalHours((h) => clampNum(Number((h + 0.25).toFixed(2)), 0, 24))}
                    aria-label="Increase hours"
                  >
                    <Plus size={17} />
                  </button>
                </div>
                <div className="lg-ruler">
                  <input
                    type="range"
                    min={0}
                    max={HOUR_MAX}
                    step={0.25}
                    value={Math.min(totalHours, HOUR_MAX)}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                    style={{ "--fill": `${hourPct}%` } as CSSProperties}
                    aria-label="Hours slider"
                  />
                  <div className="lg-ruler-ticks" aria-hidden="true">
                    {Array.from({ length: HOUR_MAX + 1 }, (_, h) => (
                      <i key={h} className={h === 8 ? "good" : h === 12 ? "peak" : h % 4 === 0 ? "major" : ""}>
                        {h % 4 === 0 ? <span>{h}</span> : null}
                      </i>
                    ))}
                  </div>
                </div>
                <div className="lg-quick">
                  {[6, 8, 10, 12].map((q) => (
                    <button
                      type="button"
                      key={q}
                      className={totalHours === q ? "is-on" : ""}
                      onClick={() => setTotalHours(q)}
                    >
                      {q}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg-dials">
                <SliderField label="Plan completion" tone="var(--nv-green)" value={completion} onChange={setCompletion} suffix="%" />
                <SliderField label="Discipline" tone="var(--nv-a1)" value={disciplineScore} onChange={setDisciplineScore} suffix="/100" />
                <StepperField label="Questions solved" value={questionsSolved} step={5} onChange={setQuestionsSolved} />
                <StepperField label="Topics studied" value={topicsStudied} step={1} onChange={setTopicsStudied} />
              </div>
            </div>
          </section>

          {/* 04 — Reflect */}
          <section className={`lg-panel${step === 3 ? " is-on" : ""}`} aria-hidden={step !== 3}>
            <div className="lg-reflect">
              <ReflectField
                tone="win"
                label="Wins"
                name="wins"
                value={wins}
                onChange={setWins}
                placeholder="What actually moved forward today?"
              />
              <ReflectField
                tone="drift"
                label="Blockers & drift"
                name="blockers"
                value={blockers}
                onChange={setBlockers}
                placeholder="Where did time leak? What stalled?"
              />
              <ReflectField
                tone="next"
                label="Tomorrow's first move"
                name="tomorrowPlan"
                value={tomorrowPlan}
                onChange={setTomorrowPlan}
                placeholder="The one clear action that opens tomorrow."
              />
            </div>
          </section>
        </div>

        {error ? (
          <div className="lg-error" role="alert">
            {error}
          </div>
        ) : null}

        <footer className="lg-actions">
          <button type="button" className="lg-btn ghost" onClick={goBack} disabled={step === 0}>
            <ArrowLeft size={16} />
            Back
          </button>
          <span className="lg-actions-count">
            {step + 1} <i>/</i> {STEPS.length}
          </span>
          {step < STEPS.length - 1 ? (
            <button type="button" className="lg-btn next" onClick={goNext}>
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button type="submit" className={`lg-btn save${saved ? " is-saved" : ""}`} disabled={pending}>
              {saved ? <Check size={17} /> : <Save size={16} />}
              {pending ? "Saving…" : saved ? "Logged" : hasTodayLog ? "Update log" : "Save the day"}
            </button>
          )}
        </footer>
      </form>
    </article>
  );
}

function SliderField({
  label,
  tone,
  value,
  onChange,
  suffix,
}: {
  label: string;
  tone: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div className="lg-dial" style={{ "--m": tone } as CSSProperties}>
      <div className="lg-dial-head">
        <span className="lg-label">{label}</span>
        <strong>
          {value}
          <em>{suffix}</em>
        </strong>
      </div>
      <input
        className="lg-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": `${value}%` } as CSSProperties}
        aria-label={label}
      />
    </div>
  );
}

function StepperField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="lg-dial lg-counter">
      <span className="lg-label">{label}</span>
      <div className="lg-counter-control">
        <button type="button" className="lg-round sm" onClick={() => onChange(clampNum(value - step, 0, 9999))} aria-label={`Decrease ${label}`}>
          <Minus size={14} />
        </button>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => onChange(clampNum(Math.round(Number(e.target.value)), 0, 9999))}
          placeholder="0"
          aria-label={label}
        />
        <button type="button" className="lg-round sm" onClick={() => onChange(clampNum(value + step, 0, 9999))} aria-label={`Increase ${label}`}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function ReflectField({
  tone,
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  tone: "win" | "drift" | "next";
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}): ReactNode {
  return (
    <label className={`lg-note tone-${tone}`}>
      <span className="lg-label">{label}</span>
      <textarea name={name} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} />
    </label>
  );
}
