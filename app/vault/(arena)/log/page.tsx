import { addArtifactAction, addLogAction, deleteArtifactAction, deleteLogAction, saveConfigAction } from "@/app/vault/actions";
import { getVaultState } from "@/lib/vault/data";
import { ROADMAP, titleCase } from "@/lib/vault/roadmap";

export const dynamic = "force-dynamic";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export default async function VaultLogPage() {
  const { metrics: m, records } = await getVaultState();
  const stageOptions = [...ROADMAP.stages.map((s) => ({ n: s.n, label: `${String(s.n).padStart(2, "0")} · ${titleCase(s.title)}` })), { n: 14, label: "14 · Capstone" }];

  return (
    <main className="fg-page">
      <header className="fg-head">
        <span className="fg-kicker"><i /> LOG · WEEK {m.week}</span>
        <h1 className="fg-title">Log the <em>work.</em></h1>
        <p className="fg-lede">Split each session the way the manual does — reading/math, implementation, adversarial testing, design review — so the cadence ring can hold you to 20/55/15/10.</p>
      </header>

      <section className="fg-grid g2">
        <form action={addLogAction} className="fg-panel fg-form">
          <h2>Today&apos;s session</h2>
          <div className="fg-row">
            <label className="fg-field">DATE<input type="date" name="logDate" defaultValue={today()} required /></label>
            <label className="fg-field">STAGE
              <select name="stage" defaultValue={m.currentStage}>
                {stageOptions.map((o) => <option key={o.n} value={o.n}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div className="fg-row">
            <label className="fg-field">READING · MIN<input type="number" name="readingMin" min={0} max={900} inputMode="numeric" placeholder="0" /></label>
            <label className="fg-field">BUILDING · MIN<input type="number" name="implementMin" min={0} max={900} inputMode="numeric" placeholder="0" /></label>
            <label className="fg-field">BREAKING · MIN<input type="number" name="adversarialMin" min={0} max={900} inputMode="numeric" placeholder="0" /></label>
            <label className="fg-field">REVIEW · MIN<input type="number" name="reviewMin" min={0} max={900} inputMode="numeric" placeholder="0" /></label>
          </div>
          <label className="fg-field">FOCUS<input name="focus" maxLength={200} placeholder="e.g. lease expiry + idempotent claim" /></label>
          <label className="fg-field">NOTES<textarea name="note" maxLength={4000} placeholder="What broke, what you measured, what you'd change" /></label>
          <button type="submit" className="fg-btn is-primary">Save session</button>
        </form>

        <form action={addArtifactAction} className="fg-panel fg-form">
          <h2>Ship an artifact</h2>
          <div className="fg-row">
            <label className="fg-field">STAGE
              <select name="stage" defaultValue={m.currentStage}>
                {stageOptions.map((o) => <option key={o.n} value={o.n}>{o.label}</option>)}
              </select>
            </label>
            <label className="fg-field">TAG<input name="tag" maxLength={80} placeholder="v0.3.0" /></label>
          </div>
          <label className="fg-field">TITLE<input name="title" maxLength={200} required placeholder="Idempotent worker queue" /></label>
          <label className="fg-field">REPO / RUN URL<input name="repoUrl" type="url" placeholder="https://github.com/…" /></label>
          <div className="fg-row">
            <label className="fg-field">P50 · MS<input name="p50Ms" type="number" step="any" min={0} /></label>
            <label className="fg-field">P95 · MS<input name="p95Ms" type="number" step="any" min={0} /></label>
            <label className="fg-field">PEAK RSS · MB<input name="peakRssMb" type="number" step="any" min={0} /></label>
            <label className="fg-field">COST / REQ · $<input name="costPerReq" type="number" step="any" min={0} /></label>
          </div>
          <label className="fg-field">ADR URL<input name="adrUrl" type="url" placeholder="https://… decision record" /></label>
          <button type="submit" className="fg-btn is-primary">Record artifact</button>
        </form>
      </section>

      <section className="fg-sect fg-panel">
        <h2>Recent sessions</h2>
        <p className="fg-sub">{m.hours.perWeek.toFixed(1)}h a week over the last 28 days · {Math.round(m.hours.total)}h logged in total.</p>
        {records.logs.length ? (
          <div className="fg-scroll">
            <table className="fg-table">
              <thead><tr><th>DATE</th><th>STAGE</th><th>FOCUS</th><th className="num">READ</th><th className="num">BUILD</th><th className="num">BREAK</th><th className="num">REVIEW</th><th /></tr></thead>
              <tbody>
                {records.logs.slice(0, 30).map((l) => (
                  <tr key={l.id}>
                    <td className="fg-mono">{l.logDate}</td>
                    <td>{l.stage}</td>
                    <td>{l.focus ?? "—"}</td>
                    <td className="num">{l.readingMin}</td>
                    <td className="num">{l.implementMin}</td>
                    <td className="num">{l.adversarialMin}</td>
                    <td className="num">{l.reviewMin}</td>
                    <td><form action={deleteLogAction.bind(null, l.id)}><button className="fg-btn is-sm" type="submit" aria-label={`Delete session ${l.logDate}`}>✕</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fg-empty"><b>No sessions yet</b>Your first logged session lights up the heatmap and the cadence ring.</div>
        )}
      </section>

      <section className="fg-sect fg-panel">
        <h2>Artifacts</h2>
        <p className="fg-sub">Every stage ends in a versioned repository with measured latency, memory and cost.</p>
        {records.artifacts.length ? (
          <div className="fg-scroll">
            <table className="fg-table">
              <thead><tr><th>STAGE</th><th>ARTIFACT</th><th className="num">P50</th><th className="num">P95</th><th className="num">RSS</th><th className="num">$/REQ</th><th /></tr></thead>
              <tbody>
                {records.artifacts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.stage}</td>
                    <td>{a.repoUrl ? <a href={a.repoUrl} target="_blank" rel="noopener noreferrer">{a.title}</a> : a.title} {a.tag ? <span className="fg-pill">{a.tag}</span> : null} {a.adrUrl ? <a className="fg-pill" href={a.adrUrl} target="_blank" rel="noopener noreferrer">ADR</a> : null}</td>
                    <td className="num">{a.p50Ms ?? "—"}</td>
                    <td className="num">{a.p95Ms ?? "—"}</td>
                    <td className="num">{a.peakRssMb ?? "—"}</td>
                    <td className="num">{a.costPerReq ?? "—"}</td>
                    <td><form action={deleteArtifactAction.bind(null, a.id)}><button className="fg-btn is-sm" type="submit" aria-label={`Delete ${a.title}`}>✕</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fg-empty"><b>Nothing shipped yet</b>Stage 1&apos;s proof artifact is a C++/Python parity benchmark.</div>
        )}
      </section>

      <section className="fg-sect">
        <form action={saveConfigAction} className="fg-panel fg-form">
          <h2>Plan settings</h2>
          <p className="fg-sub">Week 1 starts on the Monday of this date. The manual asks 15–20 focused hours a week; push higher if you can hold it.</p>
          <div className="fg-row">
            <label className="fg-field">WEEK 1 STARTS<input type="date" name="startDate" defaultValue={records.startDate} /></label>
            <label className="fg-field">WEEKLY HOUR TARGET<input type="number" name="weeklyHourTarget" min={5} max={80} step={0.5} defaultValue={records.weeklyHourTarget} /></label>
          </div>
          <button type="submit" className="fg-btn">Save settings</button>
        </form>
      </section>
    </main>
  );
}
