"use client";

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { CalendarDays, Save, Smartphone } from "lucide-react";

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

  const tone =
    totals.distraction >= 4 ? "var(--goals-danger)" : totals.distraction >= 2 ? "var(--goals-warning)" : "var(--goals-success)";
  const verdict = totals.distraction >= 4 ? "Out of control" : totals.distraction >= 2 ? "Watch the leak" : "Clean enough";

  return (
    <article className="glass panel screen-time-panel goals-ledger-card">
      <div className="goals-panel-head">
        <div>
          <div className="eyebrow">Screen time</div>
          <div className="display goals-panel-title">Distraction audit</div>
        </div>
        <div className="goals-date-chip">
          <Smartphone size={14} />
          Manual
        </div>
      </div>

      <form onSubmit={submit} className="screen-time-form">
        <div className="screen-time-audit-head" style={{ "--audit-tone": tone } as CSSProperties}>
          <label className="goals-field screen-time-date">
            <span>
              <CalendarDays size={13} />
              Log date
            </span>
            <input className="field" type="date" name="logDate" defaultValue={todayKey} required />
          </label>

          <div className="screen-time-verdict">
            <span>Distraction status</span>
            <strong>{verdict}</strong>
            <em>{totals.distraction}h distraction entered</em>
          </div>
        </div>

        <div className="screen-time-summary">
          <Summary label="Total screen" value={`${totals.total}h`} tone="var(--goals-blue)" />
          <Summary label="Distraction" value={`${totals.distraction}h`} tone={tone} />
          <Summary label="YouTube study" value={`${totals.study}h`} tone="var(--goals-success)" />
          <div className="screen-time-summary-card top-sink">
            <span>Top sink</span>
            <strong>
              {totals.top ? (
                <>
                  <AppTile app={totals.top.app} size={24} />
                  {totals.top.app.label}
                </>
              ) : (
                "None"
              )}
            </strong>
          </div>
        </div>

        <div className="screen-time-group-stack">
          {APP_GROUPS.map((group) => (
            <section key={group} className="screen-time-app-group">
              <div className="screen-time-app-group-title">
                <span>{group}</span>
                {group === "Video" ? <em>YouTube study is protected from distraction debt</em> : null}
              </div>
              <div className="screen-time-apps">
                {SCREEN_APPS.filter((app) => app.group === group).map((app) => {
                  const value = appHours(values, app.key);
                  return (
                    <div
                      key={app.key}
                      className={`screen-time-app${app.key === "youtubeStudy" ? " study-app" : ""}`}
                      style={{ "--app-color": app.solid, "--app-color-dim": `${app.solid}24` } as CSSProperties}
                    >
                      <div className="screen-time-app-main">
                        <AppTile app={app} size={30} />
                        <div>
                          <span className="screen-time-app-label">{app.label}</span>
                          <em>{app.key === "youtubeStudy" ? "study" : app.group}</em>
                        </div>
                      </div>

                      <div className="screen-time-app-entry">
                        <label className="screen-time-mini-input">
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
                          />
                          <span>h</span>
                        </label>
                        <strong>{value ? `${value}h` : "0h"}</strong>
                      </div>

                      <div className="screen-time-app-meter" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, (value / 4) * 100)}%`, background: app.solid }} />
                      </div>

                      <div className="screen-time-quick-row">
                        {QUICK_VALUES.map((quick) => (
                          <button
                            key={quick.label}
                            type="button"
                            className={value === quick.value ? "active" : ""}
                            onClick={() => setQuick(app.key, quick.value)}
                          >
                            {quick.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <label className="goals-field">
          <span>Note <em>e.g. doom-scroll after dinner / lecture on Polity</em></span>
          <textarea
            className="textarea"
            name="note"
            defaultValue={defaults.note ?? ""}
            placeholder="What pulled you in? Was any of it for study?"
          />
        </label>

        <button className="button goals-save-button" type="submit" disabled={pending}>
          <Save size={16} />
          {pending ? "Saving..." : saved ? "Saved" : "Save screen time"}
        </button>
      </form>
    </article>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="screen-time-summary-card" style={{ "--summary-tone": tone } as CSSProperties}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
