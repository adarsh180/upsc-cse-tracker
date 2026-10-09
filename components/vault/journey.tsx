import type { CSSProperties } from "react";

import type { VaultMetrics } from "@/lib/vault/metrics";

type J = VaultMetrics["journey"];
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m` : `${Math.round(min)}m`);

/** Cumulative hours, week by week, against the plan line (weekly target × weeks). */
export function HoursClimb({ j }: { j: J }) {
  const W = 640;
  const H = 220;
  const pts = j.cumulative;
  const top = Math.max(10, ...pts.map((p) => Math.max(p.hours, p.plan)));
  const x = (i: number) => (pts.length === 1 ? W / 2 : 36 + (i / (pts.length - 1)) * (W - 50));
  const y = (v: number) => H - 24 - (v / top) * (H - 40);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.hours)}`).join(" ");
  const plan = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.plan)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  return (
    <div className="fg-climb">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Cumulative hours against the plan">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="grid" x1="36" x2={W - 14} y1={y(top * f)} y2={y(top * f)} />)}
        {[0, 0.5, 1].map((f) => <text key={f} x="0" y={y(top * f) + 4}>{Math.round(top * f)}h</text>)}
        <path className="plan" d={plan} />
        <path className="area" d={area} />
        <path className="line" d={line} />
        {pts.length ? <circle className="end" cx={x(pts.length - 1)} cy={y(pts.at(-1)!.hours)} r="4.5" /> : null}
      </svg>
      <div className="fg-legend"><span><i className="k-you" />your hours</span><span><i className="k-plan" />plan at your weekly target</span></div>
    </div>
  );
}

/** Each week: hours as a bar, finished items as dots above it, scored checks as ticks. */
export function WeekStrip({ j }: { j: J }) {
  const max = Math.max(60, ...j.weekly.map((w) => w.minutes));
  return (
    <div className="fg-weeks" role="img" aria-label="Hours and completions per week">
      {j.weekly.map((w) => (
        <div key={w.week} className={`wk${w.future ? " is-future" : ""}`} style={{ "--v": w.minutes / max } as CSSProperties} title={`Week ${w.week}: ${hm(w.minutes)}, ${w.done} finished, ${w.checks} checks`}>
          <span className="dots">{Array.from({ length: Math.min(6, w.done) }, (_, i) => <i key={i} />)}</span>
          <span className="bar"><i /></span>
          {w.checks ? <b className="chk" /> : null}
          <small>{w.week % 4 === 1 ? w.week : ""}</small>
        </div>
      ))}
    </div>
  );
}

export function Weekday({ j }: { j: J }) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const max = Math.max(1, ...j.weekday);
  const total = j.weekday.reduce((s, x) => s + x, 0) || 1;
  return (
    <div className="fg-weekday">
      {j.weekday.map((m, i) => (
        <div key={names[i]} style={{ "--v": m / max } as CSSProperties}>
          <span className="bar"><i /></span>
          <b>{Math.round((m / total) * 100)}%</b>
          <small>{names[i]}</small>
        </div>
      ))}
    </div>
  );
}

export function TopicTime({ j }: { j: J }) {
  if (!j.topTopics.length) return <div className="fg-empty"><b>No topic-level time yet</b>Pick a topic when you log a session and it shows up here.</div>;
  const max = Math.max(...j.topTopics.map((t) => t.minutes));
  return (
    <ul className="fg-topictime">
      {j.topTopics.map((t, i) => (
        <li key={t.key} style={{ "--v": t.minutes / max, "--i": i } as CSSProperties}>
          <span>{t.label}{t.custom ? <em> · yours</em> : null}</span>
          <span className="bar"><i /></span>
          <b>{hm(t.minutes)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Scored checks over time, coloured by kind, with the 80% bar. */
export function ChecksChart({ j }: { j: J }) {
  const pts = j.assessments;
  if (!pts.length) return <div className="fg-empty"><b>No scored checks yet</b>Log quizzes, mock interviews and contests on the Log page.</div>;
  const W = 640;
  const H = 200;
  const x = (i: number) => (pts.length === 1 ? W / 2 : 36 + (i / (pts.length - 1)) * (W - 50));
  const y = (s: number) => H - 22 - s * (H - 36);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.share)}`).join(" ");
  return (
    <div className="fg-checks-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Scored checks as share of max">
        {[0.5, 1].map((f) => <line key={f} className="grid" x1="36" x2={W - 14} y1={y(f)} y2={y(f)} />)}
        <line className="bar80" x1="36" x2={W - 14} y1={y(0.8)} y2={y(0.8)} />
        <text x="0" y={y(0.8) + 4}>80%</text>
        <text x="0" y={y(0.5) + 4}>50%</text>
        <path className="line" d={line} />
        {pts.map((p, i) => <circle key={p.id} className={`pt k-${p.kind}`} cx={x(i)} cy={y(p.share)} r="4.5"><title>{`${p.takenOn} · ${p.title} · ${Math.round(p.share * 100)}%`}</title></circle>)}
      </svg>
      {j.byKind.length ? (
        <div className="fg-legend">
          {j.byKind.map((k) => <span key={k.key}><i className={`k-${k.key}`} />{k.label} · {k.count} · {k.level === null ? "—" : `${Math.round(k.level * 100)}%`}</span>)}
        </div>
      ) : null}
    </div>
  );
}
