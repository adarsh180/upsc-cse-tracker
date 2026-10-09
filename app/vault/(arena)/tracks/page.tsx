import type { CSSProperties } from "react";

import { addTopicAction, addTrackAction, archiveTrackAction, deleteTopicAction, deleteTrackAction, setTopicStatusAction } from "@/app/vault/actions";
import { ConfirmSubmit } from "@/components/vault/confirm-submit";
import { getVaultState } from "@/lib/vault/data";
import type { TopicRow } from "@/lib/vault/metrics";
import { CONCEPT_LEVELS, ROADMAP, titleCase } from "@/lib/vault/roadmap";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = { todo: "To do", learning: "Learning", explained: "Explained", proven: "Proven" };
const HUES = [190, 140, 265, 35, 330, 95, 210, 10];
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m` : `${Math.round(min)}m`);

function TopicList({ topics }: { topics: TopicRow[] }) {
  if (!topics.length) return <p className="fg-sub" style={{ margin: "8px 0" }}>No topics yet.</p>;
  return (
    <ul className="fg-topics">
      {topics.map((t) => (
        <li key={t.id} data-s={t.status}>
          <span className="fg-topic-name">{t.name}</span>
          <span className="fg-levels" role="group" aria-label={`Level of ${t.name}`}>
            {CONCEPT_LEVELS.map((lv) => (
              <form key={lv} action={setTopicStatusAction.bind(null, t.id, lv)}>
                <button type="submit" aria-pressed={t.status === lv}>{LEVEL_LABEL[lv]}</button>
              </form>
            ))}
          </span>
          <form action={deleteTopicAction.bind(null, t.id)}>
            <ConfirmSubmit message={`Delete the topic “${t.name}”?`} label={`Delete ${t.name}`}>✕</ConfirmSubmit>
          </form>
        </li>
      ))}
    </ul>
  );
}

export default async function VaultTracksPage() {
  const { metrics: m, records } = await getVaultState();
  const stats = new Map(m.journey.trackStats.map((t) => [t.id, t]));
  const active = records.tracks.filter((t) => !t.archived);
  const archived = records.tracks.filter((t) => t.archived);
  const stagesWithTopics = ROADMAP.stages.filter((s) => records.topics.some((t) => t.stage === s.n));

  return (
    <main className="fg-page">
      <header className="fg-head">
        <span className="fg-kicker"><i /> TRACKS · {active.length} OF YOUR OWN · {records.topics.length} EXTRA TOPICS</span>
        <h1 className="fg-title">Beyond the <em>manual.</em></h1>
        <p className="fg-lede">
          Add the subjects the manual doesn&apos;t cover — DSA, maths, MLOps, papers you are reproducing — and extra topics on any roadmap stage. Grade each one the same way as the manual&apos;s concepts: learning, explained without notes, proven in code. Log time against them on the Log page.
        </p>
      </header>

      <section className="fg-grid g2">
        <form action={addTrackAction} className="fg-panel fg-form">
          <h2>New track</h2>
          <label className="fg-field">NAME<input name="name" maxLength={120} required placeholder="e.g. DSA for interviews" /></label>
          <div className="fg-row">
            <label className="fg-field">WEEKLY TARGET · HOURS<input name="weeklyHours" type="number" min={0} max={80} step={0.5} placeholder="4" /></label>
            <fieldset className="fg-field fg-hues">
              <legend>COLOUR</legend>
              {HUES.map((h, i) => (
                <label key={h} style={{ "--h": h } as CSSProperties}>
                  <input type="radio" name="hue" value={h} defaultChecked={i === active.length % HUES.length} />
                  <i />
                </label>
              ))}
            </fieldset>
          </div>
          <label className="fg-field">WHY IT MATTERS<input name="note" maxLength={2000} placeholder="What this unlocks for the roadmap" /></label>
          <button type="submit" className="fg-btn is-primary">Create track</button>
        </form>

        <form action={addTopicAction} className="fg-panel fg-form">
          <h2>Extra topic on a roadmap stage</h2>
          <p className="fg-sub" style={{ margin: 0 }}>For things you want to master inside a stage that the manual&apos;s concept map doesn&apos;t name.</p>
          <label className="fg-field">STAGE
            <select name="stage" defaultValue={m.currentStage}>
              {ROADMAP.stages.map((s) => <option key={s.n} value={s.n}>{String(s.n).padStart(2, "0")} · {titleCase(s.title)}</option>)}
              <option value={14}>14 · Capstone</option>
            </select>
          </label>
          <label className="fg-field">TOPIC<input name="name" maxLength={200} required placeholder="e.g. Flash-attention memory layout" /></label>
          <button type="submit" className="fg-btn is-primary">Add topic</button>
        </form>
      </section>

      {active.length ? (
        <section className="fg-sect fg-tracks">
          {active.map((t) => {
            const st = stats.get(t.id);
            const own = records.topics.filter((x) => x.trackId === t.id);
            const weekPct = t.weeklyMinutes ? Math.min(1, (st?.minutes7 ?? 0) / t.weeklyMinutes) : null;
            return (
              <article key={t.id} className="fg-panel fg-track" style={{ "--h": t.hue, "--m": st?.mastery ?? 0, "--w": weekPct ?? 0 } as CSSProperties}>
                <header>
                  <i className="fg-track-dot" />
                  <div>
                    <h2>{t.name}</h2>
                    {t.note ? <p className="fg-sub" style={{ margin: "4px 0 0" }}>{t.note}</p> : null}
                  </div>
                  <div className="fg-track-acts">
                    <form action={archiveTrackAction.bind(null, t.id, true)}><button type="submit" className="fg-btn is-sm">Archive</button></form>
                    <form action={deleteTrackAction.bind(null, t.id)}><ConfirmSubmit message={`Delete the track “${t.name}” and its topics? Logged time and checks stay, unlinked.`} label={`Delete ${t.name}`}>Delete</ConfirmSubmit></form>
                  </div>
                </header>
                <dl className="fg-track-figs">
                  <div><dt>MASTERY</dt><dd>{Math.round((st?.mastery ?? 0) * 100)}<small>%</small></dd><span className="fg-meter"><i /></span></div>
                  <div><dt>PROVEN</dt><dd>{st?.proven ?? 0}<small>/{own.length}</small></dd></div>
                  <div><dt>TIME</dt><dd>{hm(st?.minutes ?? 0)}</dd></div>
                  <div><dt>THIS WEEK</dt><dd>{hm(st?.minutes7 ?? 0)}{t.weeklyMinutes ? <small> / {Math.round((t.weeklyMinutes / 60) * 10) / 10}h</small> : null}</dd>{weekPct !== null ? <span className="fg-meter is-week"><i /></span> : null}</div>
                  <div><dt>CHECKS</dt><dd>{st?.checkLevel == null ? "—" : `${Math.round(st.checkLevel * 100)}`}<small>{st?.checkLevel == null ? "" : "%"}</small></dd></div>
                </dl>
                <TopicList topics={own} />
                <form action={addTopicAction} className="fg-inline">
                  <input type="hidden" name="trackId" value={t.id} />
                  <input name="name" maxLength={200} required placeholder={`New ${t.name} topic`} aria-label={`New topic in ${t.name}`} />
                  <button type="submit" className="fg-btn is-sm">Add topic</button>
                </form>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="fg-sect">
          <div className="fg-empty"><b>No tracks yet</b>Create one above — it gets its own topics, weekly target, time and score history.</div>
        </section>
      )}

      {stagesWithTopics.length || records.topics.some((t) => t.stage === 14) ? (
        <section className="fg-sect fg-panel">
          <h2>Extra topics on roadmap stages</h2>
          <p className="fg-sub">They sit beside the manual&apos;s eight concepts per stage and show in the topic pickers.</p>
          {[...stagesWithTopics.map((s) => ({ n: s.n, title: titleCase(s.title) })), ...(records.topics.some((t) => t.stage === 14) ? [{ n: 14, title: "Capstone" }] : [])].map((s) => (
            <div key={s.n} className="fg-stage-topics">
              <h3>{String(s.n).padStart(2, "0")} · {s.title}</h3>
              <TopicList topics={records.topics.filter((t) => t.stage === s.n)} />
            </div>
          ))}
        </section>
      ) : null}

      {archived.length ? (
        <section className="fg-sect fg-panel">
          <h2>Archived tracks</h2>
          <div className="fg-chips">
            {archived.map((t) => (
              <form key={t.id} action={archiveTrackAction.bind(null, t.id, false)}>
                <button type="submit" className="fg-btn is-sm">Restore {t.name}</button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
