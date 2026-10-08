import { WhatIfSim } from "@/components/vault/what-if-sim";
import { getVaultState } from "@/lib/vault/data";

export const dynamic = "force-dynamic";

export default async function VaultWhatIfPage() {
  const { metrics: m } = await getVaultState();
  return (
    <main className="fg-page">
      <header className="fg-head">
        <span className="fg-kicker"><i /> WHAT-IF · DETERMINISTIC MODEL</span>
        <h1 className="fg-title">Bend the <em>plan.</em></h1>
        <p className="fg-lede">
          Starts from your real pace — {m.hours.perWeek.toFixed(1)}h a week, {Math.round(m.cadenceFit * 100)}% cadence fit — and the work left in every gate.
          Move a lever to see where week 48 lands. The bar never moves; only the projection does.
        </p>
      </header>
      <WhatIfSim
        observed={{
          // No logs yet: start from your weekly target so the levers mean something.
          hoursPerWeek: m.hours.perWeek > 0 ? Math.round(m.hours.perWeek * 2) / 2 : m.hours.target,
          cadenceFit: m.cadenceFit > 0 ? Math.round(m.cadenceFit * 100) / 100 : 0.8,
          reworkRate: 0.35,
        }}
        weeksElapsed={m.weeksElapsed}
        stageScores={m.stages.map((s) => s.score)}
      />
    </main>
  );
}
