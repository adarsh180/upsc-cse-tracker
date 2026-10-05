import { OddsEngine } from "@/components/dashboard/odds-engine";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { getInsights } from "@/lib/insights";
import { RankPredictionClient } from "./client";

export const metadata = { title: "Rank prediction · Sacred Attempt" };

export default async function RankPredictionPage() {
  await requireSession();
  const insights = await getInsights();

  return (
    <main className="page-shell su-page su-legacy pg-rank">
      <PageIntro
        eyebrow="AI Rank Prediction"
        title="Where you finish"
        description="Two reads on the same question. The live model updates every time you log; the AI engine writes a full three-layer projection on demand."
      />

      {insights ? (
        <section className="su-sect">
          <div className="su-sect-head">
            <span className="su-idx">१</span>
            <h2>Live model</h2>
            <p>Computed from your logs right now — no AI call. Pull the levers to test a routine.</p>
          </div>
          <OddsEngine inputs={insights.model.inputs} observed={insights.model.observed} />
        </section>
      ) : null}

      <section className="su-sect rank-prediction-workspace">
        <div className="su-sect-head">
          <span className="su-idx">{insights ? "२" : "१"}</span>
          <h2>AI projection</h2>
          <p>
            Layer 1 Prelims score vs cut-off and negative-marking risk · Layer 2 paper-wise Mains total · Layer 3 rank band,
            service projection and a monthly plan.
          </p>
        </div>
        <RankPredictionClient />
      </section>
    </main>
  );
}
