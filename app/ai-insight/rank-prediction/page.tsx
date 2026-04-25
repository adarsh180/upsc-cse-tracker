import { Trophy } from "lucide-react";
import { PageIntro } from "@/components/ui/sections";
import { requireSession } from "@/lib/auth";
import { RankPredictionClient } from "./client";

export default async function RankPredictionPage() {
  await requireSession();

  return (
    <main className="page-shell">
      <PageIntro
        eyebrow="AI Rank Prediction"
        title="Where will you finish?"
        description="A three-layer engine projects prelims, mains and final-list readiness from live tracker data."
        glyph="rank"
        actions={
          <div className="pill">
            <Trophy size={14} />
            Prelims · Mains · Final List
          </div>
        }
      />

      <section className="section-stack">
        {/* Context cards */}
        <div className="grid grid-3">
          {[
            { label: "Layer 1", title: "Prelims Prediction", desc: "Projected score vs cutoff, subject readiness radar, negative marking risk and qualifying chance." },
            { label: "Layer 2", title: "Mains Projection", desc: "Paper-wise GS + PSIR + Essay score projection and grand total against topper benchmarks." },
            { label: "Layer 3", title: "Final List", desc: "Rank band, service projection, IAS cutoff gap, monthly action plan, strengths and critical gaps." },
          ].map((card) => (
            <article key={card.label} className="glass panel">
              <div className="eyebrow">{card.label}</div>
              <div style={{ fontWeight: 800, fontSize: "1.1rem", margin: "10px 0 8px" }}>{card.title}</div>
              <p className="muted" style={{ fontSize: "13px", lineHeight: 1.7 }}>{card.desc}</p>
            </article>
          ))}
        </div>

        <RankPredictionClient />
      </section>
    </main>
  );
}
