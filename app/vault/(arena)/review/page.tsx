import { saveReviewAction } from "@/app/vault/actions";
import { AnalysisPanel } from "@/components/vault/analysis-panel";
import { RubricRadar } from "@/components/vault/instruments";
import { getVaultState } from "@/lib/vault/data";
import { mondayOf } from "@/lib/vault/metrics";
import { ROADMAP } from "@/lib/vault/roadmap";

export const dynamic = "force-dynamic";

export default async function VaultReviewPage() {
  const { metrics: m, records } = await getVaultState();
  const thisWeek = mondayOf(new Date()).toISOString().slice(0, 10);
  const current = records.reviews.find((r) => r.weekStart === thisWeek);

  return (
    <main className="fg-page">
      <header className="fg-head">
        <span className="fg-kicker"><i /> REVIEW · SUNDAY PROTOCOL</span>
        <h1 className="fg-title">Defend the <em>claims.</em></h1>
        <p className="fg-lede">Every Sunday: tag the repository, archive benchmark outputs and note unresolved risks. Then score yourself on the manual&apos;s 100-point rubric — the radar puts it beside what your evidence shows.</p>
      </header>

      <section className="fg-grid g2">
        <form action={saveReviewAction} className="fg-panel fg-form">
          <h2>Week of {thisWeek}</h2>
          <input type="hidden" name="weekStart" value={thisWeek} />
          <label className="fg-field">REPO TAG<input name="tag" maxLength={80} defaultValue={current?.tag ?? ""} placeholder="week-07" /></label>
          <label className="fg-field">SHIPPED / PROVEN<textarea name="wins" maxLength={6000} defaultValue={current?.wins ?? ""} placeholder="What is now backed by evidence?" /></label>
          <label className="fg-field">UNRESOLVED RISKS<textarea name="risks" maxLength={6000} defaultValue={current?.risks ?? ""} placeholder="What could a reviewer still break?" /></label>
          <div className="fg-row">
            {ROADMAP.rubric.map((r) => (
              <label key={r.key} className="fg-field">
                {r.label.split(" + ")[0].toUpperCase()} /{r.points}
                <input type="number" name={`rubric.${r.key}`} min={0} max={r.points} step={0.5} defaultValue={current?.rubric?.[r.key] ?? ""} />
              </label>
            ))}
          </div>
          <button type="submit" className="fg-btn is-primary">Save review</button>
        </form>
        <div className="fg-panel">
          <h2>Rubric · evidence vs self</h2>
          <p className="fg-sub">Exit condition: ≥ 85/100 in an external review, zero critical security defects, every claim reproducible.</p>
          <RubricRadar m={m} />
        </div>
      </section>

      <section className="fg-sect">
        <AnalysisPanel />
      </section>

      <section className="fg-sect fg-panel">
        <h2>Past reviews</h2>
        {records.reviews.length ? (
          <div className="fg-scroll">
            <table className="fg-table">
              <thead><tr><th>WEEK</th><th>TAG</th><th>SHIPPED</th><th>RISKS</th></tr></thead>
              <tbody>
                {[...records.reviews].reverse().map((r) => (
                  <tr key={r.id}>
                    <td className="fg-mono">{r.weekStart}</td>
                    <td>{r.tag ?? "—"}</td>
                    <td>{r.wins ?? "—"}</td>
                    <td>{r.risks ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fg-empty"><b>No reviews yet</b>Your first Sunday review starts the review streak.</div>
        )}
      </section>
    </main>
  );
}
