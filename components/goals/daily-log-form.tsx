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
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Flame,
  Gauge,
  Layers,
  ListChecks,
  Minus,
  PenLine,
  Plus,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { saveDailyGoalAction } from "@/app/actions";
import { MOMENTUM_TIERS, tierForHours } from "@/components/goals/momentum-heatmap";
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

const STEPS: { key: StepKey; label: string; hint: string; icon: ReactNode }[] = [
  { key: "mission", label: "Mission", hint: "What today was for", icon: <Target size={15} /> },
  { key: "coverage", label: "Coverage", hint: "Subjects you touched", icon: <Layers size={15} /> },
  { key: "numbers", label: "The numbers", hint: "Hours & output", icon: <Gauge size={15} /> },
  { key: "reflect", label: "Reflection", hint: "Wins, drift, next move", icon: <PenLine size={15} /> },
];

function clampNum(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
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
    if (totalHours <= 0) return "Nothing logged yet — what did the day actually hold?";
    if (isPeak) return "Peak attempt mode. This is the day that builds rank.";
    if (isGood) return "Good UPSC day cleared. Push toward the 12h ceiling.";
    if (totalHours >= 6) return `So close — ${hoursToGood.toFixed(2)}h more crosses the good-day bar.`;
    return `Below the 8h bar by ${hoursToGood.toFixed(2)}h. Tomorrow needs correction.`;
  }, [totalHours, isGood, isPeak, hoursToGood]);

  const validateStep = (index: number): string | null => {
    if (index === 0) {
      if (!logDate) return "Pick the log date first.";
      if (!primaryFocus.trim()) return "Name the mission objective for today.";
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
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
        setStep(i);
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

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <article className="glass panel dlf-panel" style={{ "--dlf-tier": tierMeta.accent, "--dlf-glow": tierMeta.glow } as CSSProperties}>
      <div className="dlf-head">
        <div className="dlf-head-copy">
          <div className="eyebrow">Daily logging</div>
          <div className="display dlf-title">Execution console</div>
          <p className="dlf-subtitle">Log the day from zero — mission, coverage, the numbers, the reflection.</p>
        </div>
        <div className="dlf-head-side">
          <div className="goals-date-chip">
            <CalendarDays size={14} />
            {todayLabel}
          </div>
          {hasTodayLog && (
            <span className="dlf-existing-chip">
              <Check size={12} />
              Today already logged — editing
            </span>
          )}
        </div>
      </div>

      {/* Live grade hero — always visible, reacts to the hours you enter */}
      <div className={`dlf-grade${isPeak ? " is-peak" : isGood ? " is-good" : ""}`}>
        <div className="dlf-grade-emoji" aria-hidden>
          <span key={tier}>{tierMeta.emoji}</span>
        </div>
        <div className="dlf-grade-body">
          <div className="dlf-grade-top">
            <strong>{tierMeta.label}</strong>
            <span className="dlf-grade-hours">{totalHours ? totalHours.toFixed(2) : "0"}<em>h</em></span>
          </div>
          <p className="dlf-grade-verdict">{verdict}</p>
          <div className="dlf-grade-meter" aria-label="Deep-work hour progress toward 8 hour and 12 hour benchmarks">
            <div className="dlf-grade-bar" aria-hidden>
              <i style={{ width: `${clampNum((totalHours / 12) * 100, 0, 100)}%` }} />
              <b className="dlf-grade-mark good" style={{ left: `${(8 / 12) * 100}%` }} />
              <b className="dlf-grade-mark peak" style={{ left: "100%" }} />
            </div>
            <div className="dlf-grade-thresholds" aria-hidden>
              <span className="good" style={{ left: `${(8 / 12) * 100}%` }}>
                <em>Good</em>
                <strong>8h</strong>
              </span>
              <span className="peak" style={{ left: "100%" }}>
                <em>Peak</em>
                <strong>12h</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="dlf-grade-mini">
          <div><span>Done</span><strong>{completion}%</strong></div>
          <div><span>Discipline</span><strong>{disciplineScore}</strong></div>
          <div><span>Qs</span><strong>{questionsSolved}</strong></div>
        </div>
      </div>

      {/* Step rail */}
      <div className="dlf-rail" role="tablist" aria-label="Logging steps">
        {STEPS.map((s, i) => (
          <button
            type="button"
            key={s.key}
            role="tab"
            aria-selected={i === step}
            className={`dlf-rail-step${i === step ? " active" : ""}${i < step ? " done" : ""}`}
            onClick={() => {
              const err = validateStep(Math.min(step, i));
              if (i > step && err) {
                setError(err);
                return;
              }
              setError(null);
              setStep(i);
            }}
          >
            <i className="dlf-rail-icon">{i < step ? <Check size={14} /> : s.icon}</i>
            <span className="dlf-rail-label">{s.label}</span>
            <span className="dlf-rail-hint">{s.hint}</span>
          </button>
        ))}
        <div className="dlf-rail-track"><i style={{ width: `${progress}%` }} /></div>
      </div>

      <form onSubmit={submit} onKeyDown={blockEnterSubmit} className="dlf-form">
        {/* hidden inputs guarantee every value posts regardless of active step */}
        <input type="hidden" name="logDate" value={logDate} />
        <input type="hidden" name="totalHours" value={totalHours} />
        <input type="hidden" name="completion" value={completion} />
        <input type="hidden" name="disciplineScore" value={disciplineScore} />
        <input type="hidden" name="questionsSolved" value={questionsSolved} />
        <input type="hidden" name="topicsStudied" value={topicsStudied} />

        {/* STEP 1 — MISSION */}
        <section className={`dlf-step${step === 0 ? " active" : ""}`} aria-hidden={step !== 0}>
          <div className="dlf-step-grid">
            <label className="dlf-field">
              <span className="dlf-field-label"><CalendarDays size={13} /> Log date</span>
              <input
                className="field"
                type="date"
                value={logDate}
                max={todayKey}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </label>
            <label className="dlf-field dlf-field-wide">
              <span className="dlf-field-label"><Target size={13} /> Mission objective</span>
              <input
                className="field"
                name="primaryFocus"
                value={primaryFocus}
                onChange={(e) => setPrimaryFocus(e.target.value)}
                placeholder="e.g. Polity: DPSP revision + 40 PYQs"
              />
              <em className="dlf-field-help">One sharp line. What was today supposed to accomplish?</em>
            </label>
          </div>
        </section>

        {/* STEP 2 — COVERAGE */}
        <section className={`dlf-step${step === 1 ? " active" : ""}`} aria-hidden={step !== 1}>
          {subjectGroups.length > 0 ? (
            <SubjectTagPicker groups={subjectGroups} defaultSelected={defaultSubjects} />
          ) : (
            <div className="dlf-empty">No syllabus subjects found yet. You can still log everything else.</div>
          )}
        </section>

        {/* STEP 3 — NUMBERS */}
        <section className={`dlf-step${step === 2 ? " active" : ""}`} aria-hidden={step !== 2}>
          <div className="dlf-numbers">
            <div className="dlf-hours-card" style={{ "--m-tone": "var(--physics)" } as CSSProperties}>
              <div className="dlf-hours-head">
                <i><Flame size={16} /></i>
                <div>
                  <span>Deep-work hours</span>
                  <em>8h good · 12h peak</em>
                </div>
              </div>
              <div className="dlf-hours-control">
                <button type="button" className="dlf-round" onClick={() => setTotalHours((h) => clampNum(Number((h - 0.25).toFixed(2)), 0, 24))} aria-label="Decrease hours">
                  <Minus size={16} />
                </button>
                <input
                  className="dlf-hours-input"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  inputMode="decimal"
                  value={totalHours || ""}
                  onChange={(e) => setTotalHours(clampNum(Number(e.target.value), 0, 24))}
                  placeholder="0"
                />
                <button type="button" className="dlf-round" onClick={() => setTotalHours((h) => clampNum(Number((h + 0.25).toFixed(2)), 0, 24))} aria-label="Increase hours">
                  <Plus size={16} />
                </button>
              </div>
              <div className="dlf-quick">
                {[6, 8, 10, 12].map((q) => (
                  <button type="button" key={q} className={`dlf-quick-chip${totalHours === q ? " active" : ""}`} onClick={() => setTotalHours(q)}>
                    {q}h
                  </button>
                ))}
              </div>
            </div>

            <div className="dlf-sliders">
              <SliderField
                label="Plan completion"
                icon={<CheckCircle2 size={15} />}
                tone="var(--botany)"
                value={completion}
                onChange={setCompletion}
                suffix="%"
              />
              <SliderField
                label="Discipline score"
                icon={<ShieldCheck size={15} />}
                tone="var(--gold)"
                value={disciplineScore}
                onChange={setDisciplineScore}
                suffix="/100"
              />
            </div>

            <div className="dlf-counters">
              <StepperField
                label="Questions solved"
                icon={<BookOpenCheck size={15} />}
                tone="var(--zoology)"
                value={questionsSolved}
                step={5}
                onChange={setQuestionsSolved}
              />
              <StepperField
                label="Topics studied"
                icon={<ListChecks size={15} />}
                tone="var(--lotus-bright)"
                value={topicsStudied}
                step={1}
                onChange={setTopicsStudied}
              />
            </div>
          </div>
        </section>

        {/* STEP 4 — REFLECTION */}
        <section className={`dlf-step${step === 3 ? " active" : ""}`} aria-hidden={step !== 3}>
          <div className="dlf-reflect">
            <label className="dlf-field dlf-reflect-field win">
              <span className="dlf-field-label"><Sparkles size={13} /> Wins</span>
              <textarea className="textarea" name="wins" value={wins} onChange={(e) => setWins(e.target.value)} placeholder="What actually moved forward today?" />
            </label>
            <label className="dlf-field dlf-reflect-field block">
              <span className="dlf-field-label"><Flame size={13} /> Blockers / drift</span>
              <textarea className="textarea" name="blockers" value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Where did time leak? What stalled?" />
            </label>
            <label className="dlf-field dlf-reflect-field next">
              <span className="dlf-field-label"><Rocket size={13} /> Tomorrow's first action</span>
              <textarea className="textarea" name="tomorrowPlan" value={tomorrowPlan} onChange={(e) => setTomorrowPlan(e.target.value)} placeholder="The one clear move to open tomorrow." />
            </label>
          </div>
        </section>

        {error && <div className="dlf-error" role="alert">{error}</div>}

        <div className="dlf-actions">
          <button type="button" className="dlf-btn ghost" onClick={goBack} disabled={step === 0}>
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="dlf-actions-right">
            {step < STEPS.length - 1 ? (
              <button type="button" className="dlf-btn next" onClick={goNext}>
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button type="submit" className={`dlf-btn save${saved ? " saved" : ""}`} disabled={pending}>
                {saved ? <Check size={17} /> : <Save size={16} />}
                {pending ? "Saving…" : saved ? "Logged" : hasTodayLog ? "Update log" : "Save execution log"}
              </button>
            )}
          </div>
        </div>
      </form>
    </article>
  );
}

function SliderField({
  label,
  icon,
  tone,
  value,
  onChange,
  suffix,
}: {
  label: string;
  icon: ReactNode;
  tone: string;
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div className="dlf-slider" style={{ "--m-tone": tone } as CSSProperties}>
      <div className="dlf-slider-head">
        <span><i>{icon}</i>{label}</span>
        <strong>{value}<em>{suffix}</em></strong>
      </div>
      <input
        className="dlf-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--fill": `${value}%` } as CSSProperties}
      />
    </div>
  );
}

function StepperField({
  label,
  icon,
  tone,
  value,
  step,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  tone: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="dlf-counter" style={{ "--m-tone": tone } as CSSProperties}>
      <div className="dlf-counter-head">
        <i>{icon}</i>
        <span>{label}</span>
      </div>
      <div className="dlf-counter-control">
        <button type="button" className="dlf-round" onClick={() => onChange(clampNum(value - step, 0, 9999))} aria-label={`Decrease ${label}`}>
          <Minus size={15} />
        </button>
        <input
          className="dlf-counter-input"
          type="number"
          min="0"
          inputMode="numeric"
          value={value || ""}
          onChange={(e) => onChange(clampNum(Math.round(Number(e.target.value)), 0, 9999))}
          placeholder="0"
        />
        <button type="button" className="dlf-round" onClick={() => onChange(clampNum(value + step, 0, 9999))} aria-label={`Increase ${label}`}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
