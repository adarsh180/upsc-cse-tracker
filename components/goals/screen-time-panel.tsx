"use client";

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { Check, Minus, Plus, Save, ShieldCheck } from "lucide-react";

import { saveScreenTimeAction } from "@/app/actions";
import { AppTile, SCREEN_APPS, type ScreenApp } from "@/components/goals/app-icons";

export type ScreenTimeDefaults = { [key: string]: number | string | undefined; note?: string };

const APP_GROUPS = ["Social", "Video", "Utility"] as const;
const QUICK_VALUES = [
  { label: "0", value: 0 },
  { label: "30m", value: 0.5 },
  { label: "1h", value: 1 },
  { label: "2h", value: 2 },
];
/** Daily distraction budget. Above it the day is "leaking"; double it is out of control. */
const BUDGET = 2;
const METER_MAX = 6;

function appHours(values: Record<string, string>, key: string) {
  return Number(values[key]) || 0;
}

function formatHours(value: number) {
  return Number(value.toFixed(2));
}

function clampHours(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(24, Math.max(0, value));
}

export function ScreenTimePanel({
  todayKey,
  defaults = {},
}: {
  todayKey: string;
  defaults?: ScreenTimeDefaults;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SCREEN_APPS.map((app) => {
        const v = Number(defaults[app.key] ?? 0);
        return [app.key, v ? String(v) : ""];
      }),
    ),
  );

  const totals = useMemo(() => {
    let total = 0;
    let distraction = 0;
    let study = 0;
    let top: { app: ScreenApp; value: number } | null = null;

    for (const app of SCREEN_APPS) {
      const v = appHours(values, app.key);
      total += v;
      if (app.key === "youtubeStudy") study += v;
      else {
        distraction += v;
        if (!top || v > top.value) top = { app, value: v };
      }
    }

    return {
      total: formatHours(total),
      distraction: formatHours(distraction),
      study: formatHours(study),
      top: top && top.value > 0 ? top : null,
    };
  }, [values]);

  const set = (key: string, v: string) => {
    const n = clampHours(Number(v));
    setValues((cur) => ({ ...cur, [key]: Number.isNaN(Number(v)) || v === "" ? "" : String(n) }));
  };

  const nudge = (key: string, delta: number) => {
    setValues((cur) => {
      const next = clampHours(Number(((Number(cur[key]) || 0) + delta).toFixed(2)));
      return { ...cur, [key]: next ? String(next) : "" };
    });
  };

  const setQuick = (key: string, value: number) => {
    setValues((cur) => ({ ...cur, [key]: value ? String(value) : "" }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await saveScreenTimeAction(formData);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    });
  };

  const status =
    totals.distraction >= BUDGET * 2 ? "bad" : totals.distraction > BUDGET ? "warn" : "ok";
  const verdict = status === "bad" ? "Out of control" : status === "warn" ? "Leaking" : "Within budget";
  const meterPct = Math.min(100, (totals.distraction / METER_MAX) * 100);

  return (
    <article className="st">
      <form onSubmit={submit} className="st-form">
        <div className={`st-budget is-${status}`}>
          <div className="st-budget-top">
            <label className="st-date">
              <span className="lg-label">Log date</span>
              <input className="lg-input" type="date" name="logDate" defaultValue={todayKey} required />
            </label>
            <div className="st-verdict">
              <span className="lg-label">Distraction</span>
              <strong>
                {totals.distraction}
                <em>h</em>
              </strong>
              <b>{verdict}</b>
            </div>
          </div>
          <div className="st-meter" aria-hidden="true">
            <span className="st-meter-track">
              <i style={{ width: `${meterPct}%` }} />
            </span>
            <span className="st-meter-mark" style={{ left: `${(BUDGET / METER_MAX) * 100}%` }}>
              {BUDGET}h budget
            </span>
            <span className="st-meter-mark bad" style={{ left: `${((BUDGET * 2) / METER_MAX) * 100}%` }}>
              {BUDGET * 2}h
            </span>
          </div>
          <dl className="st-sums">
            <div>
              <dt>Total screen</dt>
              <dd>{totals.total}h</dd>
            </div>
            <div className="is-study">
              <dt>Study YouTube</dt>
              <dd>{totals.study}h</dd>
            </div>
            <div>
              <dt>Top sink</dt>
              <dd className="st-top">
                {totals.top ? (
                  <>
                    <AppTile app={totals.top.app} size={18} />
                    {totals.top.app.label}
                  </>
                ) : (
                  "None"
                )}
              </dd>
            </div>
          </dl>
        </div>

        {APP_GROUPS.map((group) => (
          <section key={group} className="st-group">
            <div className="st-group-head">
              <span>{group}</span>
              {group === "Video" ? (
                <em>
                  <ShieldCheck size={12} /> Study YouTube never counts as distraction
                </em>
              ) : null}
            </div>
            <div className="st-apps">
              {SCREEN_APPS.filter((app) => app.group === group).map((app) => {
                const value = appHours(values, app.key);
                const isStudy = app.key === "youtubeStudy";
                return (
                  <div
                    key={app.key}
                    className={`st-app${isStudy ? " is-study" : ""}${value > 0 ? " has-value" : ""}`}
                    style={{ "--app": app.solid } as CSSProperties}
                  >
                    <AppTile app={app} size={30} />
                    <div className="st-app-name">
                      <b>{app.label}</b>
                      <div className="st-app-quick">
                        {QUICK_VALUES.map((quick) => (
                          <button
                            key={quick.label}
                            type="button"
                            className={value === quick.value && (quick.value > 0 || values[app.key] === "") ? "is-on" : ""}
                            onClick={() => setQuick(app.key, quick.value)}
                          >
                            {quick.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="st-stepper">
                      <button type="button" onClick={() => nudge(app.key, -0.25)} aria-label={`Less ${app.label}`}>
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        name={app.key}
                        value={values[app.key]}
                        onChange={(e) => set(app.key, e.target.value)}
                        placeholder="0"
                        inputMode="decimal"
                        aria-label={`${app.label} hours`}
                      />
                      <button type="button" onClick={() => nudge(app.key, 0.25)} aria-label={`More ${app.label}`}>
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="st-app-bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, (value / 4) * 100)}%` }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <label className="lg-note tone-drift st-note">
          <span className="lg-label">Note</span>
          <textarea
            name="note"
            defaultValue={defaults.note ?? ""}
            placeholder="What pulled you in? Was any of it for study?"
            rows={2}
          />
        </label>

        <div className="st-actions">
          <button className={`lg-btn save${saved ? " is-saved" : ""}`} type="submit" disabled={pending}>
            {saved ? <Check size={16} /> : <Save size={15} />}
            {pending ? "Saving…" : saved ? "Saved" : "Save screen time"}
          </button>
        </div>
      </form>
    </article>
  );
}
