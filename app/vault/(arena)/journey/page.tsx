import Link from "next/link";
import type { CSSProperties } from "react";

import { ChecksChart, HoursClimb, TopicTime, WeekStrip, Weekday } from "@/components/vault/journey";
import { getVaultState } from "@/lib/vault/data";
import { ROADMAP, titleCase } from "@/lib/vault/roadmap";

export const dynamic = "force-dynamic";

const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m` : `${Math.round(min)}m`);
const trend = (now: number, prev: number) => (prev === 0 ? (now > 0 ? "up from nothing" : "flat") : `${now >= prev ? "+" : "−"}${Math.abs(Math.round(((now - prev) / prev) * 100))}% vs the 4 weeks before`);

export default async function VaultJourneyPage() {
  const { metrics: m } = await getVaultState();
  const j = m.journey;
  const vsPlan = j.planHours ? j.totalHours / j.planHours : 0;

  return (
    <main className="fg-page">
      <header className="fg-head">
        <span className="fg-kicker"><i /> JOURNEY · WEEK {m.week} · STARTED {m.startDate}</span>
        <h1 className="fg-title">The road <em>so far.</em></h1>
        <p className="fg-lede">Every hour, session, finished concept and scored check since week 1 — the manual&apos;s stages and your own tracks together. Compared with the plan and with your previous four weeks, never adjusted down.</p>
      </header>

      <section className="fg-panel">
        <dl className="fg-stats fg-stats-6">
          <div className="fg-stat"><dt>TOTAL HOURS</dt><dd className={vsPlan >= 1 ? "is-ahead" : vsPlan >= 0.7 ? "is-on" : "is-behind"}>{Math.round(j.totalHours)}<small>/ {Math.round(j.planHours)}h plan</small></dd><span className="fg-note">{Math.round(vsPlan * 100)}% of the plan to date</span></div>
          <div className="fg-stat"><dt>LAST 28 DAYS</dt><dd>{j.hours28.toFixed(1)}<small>h</small></dd><span className="fg-note">{trend(j.hours28, j.hoursPrev28)}</span></div>
          <div className="fg-stat"><dt>VELOCITY</dt><dd>{j.velocity.toFixed(1)}<small>/ wk</small></dd><span className="fg-note">items finished · {trend(j.velocity, j.velocityPrev)}</span></div>
          <div className="fg-stat"><dt>SESSIONS</dt><dd>{j.sessions}</dd><span className="fg-note">avg {hm(j.avgSession)} · longest {hm(j.longestSession)}</span></div>
          <div className="fg-stat"><dt>STREAK</dt><dd>{m.hours.streak}<small>d</small></dd><span className="fg-note">longest {j.longestStreak} days · {j.activeDays} active days</span></div>
          <div className="fg-stat"><dt>BEST WEEK</dt><dd>{j.bestWeek.week ? hm(j.bestWeek.minutes) : "—"}</dd><span className="fg-note">{j.bestWeek.week ? `week ${j.bestWeek.week}` : "no logs yet"}{j.bestDay.date ? ` · best day ${hm(j.bestDay.minutes)}` : ""}</span></div>
        </dl>
      </section>

      <section className="fg-sect fg-grid g2">
        <div className="fg-panel">
          <h2>Hours climb</h2>
          <p className="fg-sub">Cumulative hours since week 1 against {m.hours.target}h a week.</p>
          <HoursClimb j={j} />
        </div>
        <div className="fg-panel">
          <h2>Week by week</h2>
          <p className="fg-sub">Bars are hours; dots above are concepts, gate items and topics finished that week; a lime tick marks a scored check.</p>
          <WeekStrip j={j} />
        </div>
      </section>

      <section className="fg-sect fg-grid g2">
        <div className="fg-panel">
          <h2>Where the hours go</h2>
          <p className="fg-sub">Top topics by logged time — manual concepts and your own.</p>
          <TopicTime j={j} />
        </div>
        <div className="fg-panel">
          <h2>Your week shape</h2>
          <p className="fg-sub">Share of all logged time by weekday.</p>
          <Weekday j={j} />
          <h3 className="fg-h3">Time by stage</h3>
          <ul className="fg-stagetime">
            {m.stages.filter((s) => s.minutes > 0).map((s) => (
              <li key={s.n} style={{ "--v": s.minutes / Math.max(...m.stages.map((x) => x.minutes), 1) } as CSSProperties}>
                <span>{String(s.n).padStart(2, "0")} · {titleCase(ROADMAP.stages[s.n - 1].title)}</span>
                <span className="bar"><i /></span>
                <b>{hm(s.minutes)}</b>
              </li>
            ))}
            {!m.stages.some((s) => s.minutes > 0) ? <li className="fg-sub">No stage time logged yet.</li> : null}
          </ul>
        </div>
      </section>

      <section className="fg-sect fg-grid g2">
        <div className="fg-panel">
          <h2>Scored checks</h2>
          <p className="fg-sub">{j.assessLevel === null ? "None logged yet." : `Recent level ${Math.round(j.assessLevel * 100)}% of max — the bar is 80%.`}</p>
          <ChecksChart j={j} />
        </div>
        <div className="fg-panel">
          <h2>Your tracks</h2>
          <p className="fg-sub">{j.customTopics} extra topics · {j.customTopicsProven} proven. <Link href="/vault/tracks">Manage tracks →</Link></p>
          {j.trackStats.length ? (
            <ul className="fg-trackrows">
              {j.trackStats.filter((t) => !t.archived).map((t) => (
                <li key={t.id} style={{ "--h": t.hue, "--m": t.mastery } as CSSProperties}>
                  <i className="fg-track-dot" />
                  <span><b>{t.name}</b><small>{t.topics} topics · {t.proven} proven · {hm(t.minutes)}{t.checkLevel !== null ? ` · checks ${Math.round(t.checkLevel * 100)}%` : ""}</small></span>
                  <span className="fg-meter"><i /></span>
                  <em>{Math.round(t.mastery * 100)}%</em>
                </li>
              ))}
            </ul>
          ) : (
            <div className="fg-empty"><b>No tracks yet</b>Add DSA, maths, MLOps or anything else on the Tracks page.</div>
          )}
        </div>
      </section>
    </main>
  );
}
