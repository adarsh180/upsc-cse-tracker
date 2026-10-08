import { ROADMAP, TOTAL_WEEKS } from "@/lib/vault/roadmap";

/**
 * What-if: how the 48-week plan bends with weekly hours, cadence discipline and
 * gate rework. Pure and deterministic. The manual sizes each stage for roughly
 * 17.5 focused hours a week (its 15–20h band), so that is the 1.0x pace.
 */

export type WhatIfLevers = { hoursPerWeek: number; cadenceFit: number; reworkRate: number };
export const BASE_HOURS = 17.5;

export function runWhatIf(levers: WhatIfLevers, state: { weeksElapsed: number; stageScores: number[] }) {
  const pace =
    Math.max(0.05, levers.hoursPerWeek / BASE_HOURS) /
    ((1 + 0.6 * Math.max(0, Math.min(1, levers.reworkRate))) * (1 + 0.35 * (1 - Math.max(0, Math.min(1, levers.cadenceFit)))));
  const remainingPlanWeeks = ROADMAP.stages.reduce((s, st, i) => s + (st.weeks[1] - st.weeks[0] + 1) * (1 - (state.stageScores[i] ?? 0)), 0);
  const weeksNeeded = remainingPlanWeeks / pace;
  const finishWeek = Math.round((state.weeksElapsed + weeksNeeded) * 10) / 10;
  const weeksLeft = Math.max(0, TOTAL_WEEKS - state.weeksElapsed);
  const doneNow = ROADMAP.stages.reduce((s, st, i) => s + (st.weeks[1] - st.weeks[0] + 1) * (state.stageScores[i] ?? 0), 0);
  const doneBy48 = Math.min(TOTAL_WEEKS, doneNow + weeksLeft * pace);
  // Stage-by-stage projected finish week under these levers.
  let cursor = state.weeksElapsed;
  const stageFinish = ROADMAP.stages.map((st, i) => {
    cursor += ((st.weeks[1] - st.weeks[0] + 1) * (1 - (state.stageScores[i] ?? 0))) / pace;
    return { n: st.n, planned: st.weeks[1], projected: Math.round(cursor * 10) / 10 };
  });
  return {
    pace,
    finishWeek,
    slipWeeks: Math.round((finishWeek - TOTAL_WEEKS) * 10) / 10,
    progressAt48: doneBy48 / TOTAL_WEEKS,
    stageFinish,
  };
}
