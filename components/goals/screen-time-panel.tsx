"use client";

import { useMemo, useState, useTransition, type CSSProperties, type FormEvent } from "react";
import { Save, Smartphone } from "lucide-react";

import { saveScreenTimeAction } from "@/app/actions";
import { AppTile, SCREEN_APPS } from "@/components/goals/app-icons";

export type ScreenTimeDefaults = { [key: string]: number | string | undefined; note?: string };

const APP_GROUPS = ["Social", "Video", "Utility"] as const;

export function ScreenTimePanel({
  todayKey,
  defaults = {},
}: {
  todayKey: string;
  defaults?: ScreenTimeDefaults;
}) {
  const [pending, startTransition] = useTransition();
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
    for (const app of SCREEN_APPS) {
      const v = Number(values[app.key]) || 0;
      total += v;
      if (app.key === "youtubeStudy") study += v;
      else distraction += v;
    }
    return {
      total: Number(total.toFixed(2)),
      distraction: Number(distraction.toFixed(2)),
      study: Number(study.toFixed(2)),
    };
  }, [values]);

  const set = (key: string, v: string) => setValues((cur) => ({ ...cur, [key]: v }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await saveScreenTimeAction(formData);
    });
  };

  const distractionTone =
    totals.distraction >= 4 ? "var(--danger)" : totals.distraction >= 2 ? "hsl(38,92%,62%)" : "hsl(148,62%,56%)";

  const verdict =
    totals.distraction >= 4
      ? "Cut this hard"
      : totals.distraction >= 2
        ? "Watch the leak"
        : "Clean enough";

  return (
    <article className="glass panel screen-time-panel">
      <div className="goals-panel-head">
        <div>
          <div className="eyebrow">Screen time</div>
          <div className="display goals-panel-title">Distraction ledger</div>
        </div>
        <div className="goals-date-chip">
          <Smartphone size={14} />
          Manual
        </div>
      </div>

      <form onSubmit={submit} className="screen-time-form">
        <div className="screen-time-control-row">
          <label className="goals-field screen-time-date">
            <span>Log date</span>
            <input className="field" type="date" name="logDate" defaultValue={todayKey} required />
          </label>
          <div className="screen-time-verdict" style={{ "--verdict-tone": distractionTone } as CSSProperties}>
            <strong>{verdict}</strong>
            <span>{totals.distraction}h distraction entered</span>
          </div>
        </div>

        <div className="screen-time-group-stack">
          {APP_GROUPS.map((group) => (
            <section key={group} className="screen-time-app-group">
              <div className="screen-time-app-group-title">
                <span>{group}</span>
                {group === "Video" ? <em>YouTube study is tracked separately</em> : null}
              </div>
              <div className="screen-time-apps">
                {SCREEN_APPS.filter((app) => app.group === group).map((app) => (
                  <label
                    key={app.key}
                    className={`screen-time-app${app.key === "youtubeStudy" ? " study-app" : ""}`}
                    style={
                      {
                        "--app-color": app.solid,
                        "--app-color-dim": `${app.solid}26`,
                      } as CSSProperties
                    }
                  >
                    <AppTile app={app} size={42} />
                    <div className="screen-time-app-body">
                      <span className="screen-time-app-label">{app.label}</span>
                      <div className="screen-time-input-wrap">
                        <input
                          className="field"
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
                        <em>h</em>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="screen-time-summary">
          <div className="screen-time-summary-card">
            <span>Total on screen</span>
            <strong>{totals.total}h</strong>
          </div>
          <div className="screen-time-summary-card">
            <span>Distraction</span>
            <strong style={{ color: distractionTone }}>{totals.distraction}h</strong>
          </div>
          <div className="screen-time-summary-card">
            <span>YouTube study</span>
            <strong style={{ color: "hsl(148,62%,56%)" }}>{totals.study}h</strong>
          </div>
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
          {pending ? "Saving..." : "Save screen time"}
        </button>
      </form>
    </article>
  );
}
