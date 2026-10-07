/**
 * Exam readiness today — a 0–100 index of how prepared you are right now for
 * the real goal (a top service: IAS / IFS / IPS / IRS), not a projection.
 *
 * Basis for every number:
 *  · Coverage and revision are weighted by exam marks (lib/exam-weights.ts):
 *    Prelims by each subject's share of GS Paper I questions, Mains by its
 *    share of the 1,750 written marks — not one vote per topic.
 *  · Prelims tests are read against a safe score above the rising cut-off
 *    (General: 75.4 → 88.0 → 92.7 of 200, 2023–25): 55% of max marks.
 *  · CSAT is qualifying (66/200) but recent papers have been hard enough to
 *    end strong attempts, so it is a gate of its own.
 *  · A top service needs a high final rank, so Mains (optional, essay, GS
 *    answer writing) carries real weight even before Prelims.
 *  · Weights move with the calendar: as 23 May 2027 nears, the Prelims parts
 *    take more of the score; after Prelims, Mains takes over.
 * Each part is scored 0..1 from live records; no evidence scores zero.
 */

export type ReadinessPart = {
  key: string;
  label: string;
  weight: number;
  score: number; // 0..1
  value: string;
  note: string;
  href: string;
  evidence: boolean;
  stage: "Prelims" | "Mains" | "Both";
};

export type Readiness = {
  score: number; // 0..100
  band: string;
  parts: ReadinessPart[];
  lever: { key: string; label: string; points: number } | null;
  basis: string;
};

export type SyllabusCompletion = {
  leaves: number;
  done: number;
  revised: number;
  ticked: number; // done / leaves (raw topic count)
  revisedShare: number; // revised / leaves
  hours: number;
  hoursCover: number; // hours against a ~2,200h first pass
  prelims: number; // Prelims-weighted ticked share (GS Paper I question weights)
  mains: number; // Mains-weighted ticked share (1,750 written marks)
  prelimsEffective: number; // prelims ticks blended with hours studied
  mainsEffective: number;
  revisedWeighted: number; // marks-weighted share revised at least once
  effective: number; // headline: stage-blended effective coverage
  prelimsShare: number; // how much of the headline is Prelims right now
};

export type ReadinessInput = {
  syllabus: SyllabusCompletion;
  daysToPrelims: number;
  daysToMains: number;
  avgRevisionPasses: number;
  testScore: number | null; // recency-weighted prelims share of max marks
  testCount: number;
  prelimsTests: number;
  tests30: number;
  testedSubjects: number;
  accuracy: number | null;
  csatScore: number | null; // share of max
  mainsEvidence: number;
  mainsTestScore: number | null; // share of max in Mains tests, if any
  hoursPerDay28: number;
  loggedDays28: number;
  confidence: number | null; // 0..1
  stress: number | null; // 0..10
};

/** A full first pass of the UPSC syllabus is about 2,200 hours of study. */
export const FULL_PASS_HOURS = 2200;

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Ticks lag real study, so — as in the selection model — blend them with hours. */
export function effectiveCoverage(ticked: number, hours: number) {
  return clamp(0.45 * ticked + 0.55 * clamp(hours / FULL_PASS_HOURS));
}

/** 0 while Prelims is 10+ months out, 1 in the final three months. */
export function prelimsPhase(daysToPrelims: number) {
  return clamp((300 - daysToPrelims) / 210);
}

export function bandFor(score: number) {
  if (score >= 85) return "Exam-ready";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Competitive";
  if (score >= 30) return "Building";
  return "Foundation";
}

function settleWeights<K extends string>(base: Record<K, number>, mult: Record<K, number>): Record<K, number> {
  const keys = Object.keys(base) as K[];
  const raw = keys.map((k) => base[k] * mult[k]);
  const total = raw.reduce((s, x) => s + x, 0) || 1;
  const exact = raw.map((x) => (x / total) * 100);
  const floor = exact.map(Math.floor);
  let left = 100 - floor.reduce((s, x) => s + x, 0);
  for (const { i } of exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)) {
    if (left <= 0) break;
    floor[i] += 1;
    left -= 1;
  }
  return Object.fromEntries(keys.map((k, i) => [k, floor[i]])) as Record<K, number>;
}

type Key = "prelimsCover" | "tests" | "accuracy" | "csat" | "practice" | "mainsCover" | "writing" | "revision" | "consistency" | "wellbeing";

export function computeReadiness(i: ReadinessInput): Readiness {
  const s = i.syllabus;
  const afterPrelims = i.daysToPrelims === 0 && i.daysToMains > 0;
  const phase = prelimsPhase(i.daysToPrelims);
  const pm = afterPrelims ? 0.15 : 0.9 + 0.3 * phase;
  const mm = afterPrelims ? 2 : 1.15 - 0.4 * phase;
  const w = settleWeights<Key>(
    { prelimsCover: 15, tests: 14, accuracy: 5, csat: 6, practice: 6, mainsCover: 14, writing: 11, revision: 13, consistency: 12, wellbeing: 4 },
    { prelimsCover: pm, tests: pm, accuracy: pm, csat: pm, practice: pm, mainsCover: mm, writing: mm, revision: 1, consistency: 1, wellbeing: 1 },
  );

  const writingVolume = clamp(i.mainsEvidence / 30);
  const parts: ReadinessPart[] = [
    {
      key: "prelimsCover",
      label: "Prelims syllabus",
      stage: "Prelims",
      weight: w.prelimsCover,
      score: s.prelimsEffective,
      value: `${pct(s.prelimsEffective)} effective`,
      note: `weighted by GS Paper I questions per subject · ${pct(s.prelims)} by ticks, blended with ${Math.round(s.hours).toLocaleString("en-IN")}h studied`,
      href: "/study/general-studies-2",
      evidence: s.done > 0 || s.hours > 0,
    },
    {
      key: "tests",
      label: "Prelims test scores",
      stage: "Prelims",
      weight: w.tests,
      // 55% of max ≈ 110/200 — clear of the 92.66 cut-off (2025) with room for
      // a tougher paper; fewer than six tests counts for less.
      score: i.testScore === null ? 0 : clamp(i.testScore / 0.55) * (0.5 + 0.5 * clamp(i.prelimsTests / 6)),
      value: i.testScore === null ? "no prelims tests" : `${pct(i.testScore)} recent average`,
      note: `target 55% (≈110/200) vs 2025 cut-off 92.66 · from ${i.prelimsTests} test${i.prelimsTests === 1 ? "" : "s"}, full weight at 6`,
      href: "/tests",
      evidence: i.testScore !== null,
    },
    {
      key: "accuracy",
      label: "Accuracy",
      stage: "Prelims",
      weight: w.accuracy,
      // −1/3 per wrong answer: 50% earns nothing here, 80%+ is full marks.
      score: i.accuracy === null ? 0 : clamp((i.accuracy - 0.5) / 0.3),
      value: i.accuracy === null ? "not measured" : `${pct(i.accuracy)} right`,
      note: "at −⅓ per wrong answer, toppers attempt ~85–90 at ~80% accuracy",
      href: "/tests/error-analysis",
      evidence: i.accuracy !== null,
    },
    {
      key: "csat",
      label: "CSAT safety",
      stage: "Prelims",
      weight: w.csat,
      // Qualifying at 33%; recent papers are hard, so 50% is the safe line.
      score: i.csatScore === null ? 0 : clamp((i.csatScore - 0.33) / 0.17),
      value: i.csatScore === null ? "not measured" : `${pct(i.csatScore)} in CSAT papers`,
      note: "qualifying at 66/200 — aim 100/200 to be safe on a hard paper",
      href: "/study/csat",
      evidence: i.csatScore !== null,
    },
    {
      key: "practice",
      label: "Test practice",
      stage: "Prelims",
      weight: w.practice,
      score: clamp(0.6 * clamp(i.tests30 / 4) + 0.4 * clamp(i.testedSubjects / 6)),
      value: `${i.tests30} in 30 days · ${i.testedSubjects}/6 subjects`,
      note: "a full test every week, every GS subject tested",
      href: "/tests",
      evidence: i.testCount > 0,
    },
    {
      key: "mainsCover",
      label: "Mains syllabus",
      stage: "Mains",
      weight: w.mainsCover,
      score: s.mainsEffective,
      value: `${pct(s.mainsEffective)} effective`,
      note: `weighted by the 1,750 written marks — PSIR 500, Essay 250, GS I–IV 250 each · ${pct(s.mains)} by ticks`,
      href: "/study/psir",
      evidence: s.done > 0 || s.hours > 0,
    },
    {
      key: "writing",
      label: "Answer writing",
      stage: "Mains",
      weight: w.writing,
      score: i.mainsTestScore === null ? writingVolume : clamp(0.55 * writingVolume + 0.45 * clamp(i.mainsTestScore / 0.5)),
      value: `${Math.round(i.mainsEvidence)} pieces of evidence${i.mainsTestScore === null ? "" : ` · ${pct(i.mainsTestScore)} in Mains tests`}`,
      note: "top-service ranks are won here — Mains tests, essays, daily answers (aim 30+)",
      href: "/ai-insight/essay-checker",
      evidence: i.mainsEvidence > 0,
    },
    {
      key: "revision",
      label: "Revision",
      stage: "Both",
      weight: w.revision,
      score: clamp(0.75 * clamp(s.revisedWeighted / 0.6) + 0.25 * clamp(i.avgRevisionPasses / 3)),
      value: `${s.revised.toLocaleString("en-IN")} topics revised`,
      note: `${pct(s.revisedWeighted)} of the exam's marks revised · aim 60% with 3 passes before Prelims`,
      href: "/study/general-studies-3",
      evidence: s.revised > 0,
    },
    {
      key: "consistency",
      label: "Consistency",
      stage: "Both",
      weight: w.consistency,
      score: clamp(0.55 * clamp(i.hoursPerDay28 / 12) + 0.45 * clamp(i.loggedDays28 / 28)),
      value: `${i.hoursPerDay28.toFixed(1)}h a day · ${i.loggedDays28}/28 days`,
      note: "push-hard benchmark: 12h a day, every day logged",
      href: "/goals",
      evidence: i.loggedDays28 > 0,
    },
    {
      key: "wellbeing",
      label: "Confidence & calm",
      stage: "Both",
      weight: w.wellbeing,
      score: i.confidence === null ? 0 : clamp(0.6 * i.confidence + 0.4 * (1 - clamp((i.stress ?? 5) / 10))),
      value: i.confidence === null ? "not logged" : `confidence ${Math.round(i.confidence * 10)}/10 · stress ${Math.round(i.stress ?? 0)}/10`,
      note: "from your last ten mood check-ins",
      href: "/mood",
      evidence: i.confidence !== null,
    },
  ];
  const score = Math.round(parts.reduce((sum, p) => sum + p.weight * p.score, 0));
  const top = [...parts].sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score))[0];
  const prelimsWeight = parts.filter((p) => p.stage === "Prelims").reduce((n, p) => n + p.weight, 0);
  const mainsWeight = parts.filter((p) => p.stage === "Mains").reduce((n, p) => n + p.weight, 0);
  return {
    score,
    band: bandFor(score),
    parts,
    lever: top ? { key: top.key, label: top.label, points: Math.round(top.weight * (1 - top.score)) } : null,
    basis: afterPrelims
      ? `Prelims is behind you — Mains parts now carry ${mainsWeight} of 100 points.`
      : `Set for a top-service rank. Right now Prelims parts carry ${prelimsWeight} points and Mains ${mainsWeight}; Prelims gains weight as 23 May nears.`,
  };
}
