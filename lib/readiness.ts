/**
 * Exam readiness today — a 0–100 index of how prepared you are right now
 * (not a projection). Each part is scored 0..1 from live records and carries
 * a fixed weight; a part with no evidence scores zero and says so.
 */

export type ReadinessPart = {
  key: string;
  label: string;
  weight: number;
  score: number; // 0..1
  value: string; // what was measured
  note: string; // the target it is read against
  href: string;
  evidence: boolean;
};

export type Readiness = {
  score: number; // 0..100
  band: string;
  parts: ReadinessPart[];
  lever: { key: string; label: string; points: number } | null;
};

export type SyllabusCompletion = {
  leaves: number;
  done: number;
  revised: number;
  ticked: number; // done / leaves
  revisedShare: number; // revised / leaves
  effective: number; // ticks blended with hours studied
  hours: number;
  prelims: number; // GS 1–3 ticked share
  mains: number; // Mains papers ticked share
};

export type ReadinessInput = {
  syllabus: SyllabusCompletion;
  avgRevisionPasses: number;
  testScore: number | null; // recency-weighted prelims share of max marks
  testCount: number;
  prelimsTests: number;
  tests30: number;
  testedSubjects: number;
  accuracy: number | null;
  mainsEvidence: number;
  hoursPerDay28: number;
  loggedDays28: number;
  confidence: number | null; // 0..1
  stress: number | null; // 0..10
};

/** A full first pass of the UPSC syllabus is about 2,200 hours of study. */
export const FULL_PASS_HOURS = 2200;

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function effectiveCoverage(ticked: number, hours: number) {
  // Ticks lag real study, so — as in the selection model — blend them with hours.
  return clamp(0.45 * ticked + 0.55 * clamp(hours / FULL_PASS_HOURS));
}

export function bandFor(score: number) {
  if (score >= 85) return "Exam-ready";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Competitive";
  if (score >= 30) return "Building";
  return "Foundation";
}

export function computeReadiness(i: ReadinessInput): Readiness {
  const s = i.syllabus;
  const parts: ReadinessPart[] = [
    {
      key: "coverage",
      label: "Syllabus covered",
      weight: 22,
      score: s.effective,
      value: `${pct(s.effective)} effective`,
      note: `${pct(s.ticked)} ticked · ${Math.round(s.hours).toLocaleString("en-IN")}h of a ~${FULL_PASS_HOURS.toLocaleString("en-IN")}h first pass`,
      href: "/study/general-studies-1",
      evidence: s.done > 0 || s.hours > 0,
    },
    {
      key: "revision",
      label: "Revision",
      weight: 13,
      // Share of the whole map revised at least once (70% is full marks),
      // nudged by how many passes finished topics have had.
      score: clamp(0.75 * clamp(s.revisedShare / 0.7) + 0.25 * clamp(i.avgRevisionPasses / 3)),
      value: `${s.revised.toLocaleString("en-IN")} topics revised`,
      note: `${pct(s.revisedShare)} of the syllabus · aim 70% before Prelims`,
      href: "/study/general-studies-3",
      evidence: s.revised > 0,
    },
    {
      key: "tests",
      label: "Test scores",
      weight: 18,
      // 55% of max in GS mocks sits comfortably above recent cut-offs; a
      // handful of tests is weaker evidence, so it counts for less until six.
      score: i.testScore === null ? 0 : clamp(i.testScore / 0.55) * (0.5 + 0.5 * clamp(i.prelimsTests / 6)),
      value: i.testScore === null ? "no prelims tests" : `${pct(i.testScore)} recent average`,
      note: `55% of max marks clears the cut-off · from ${i.prelimsTests} test${i.prelimsTests === 1 ? "" : "s"}, full weight at 6`,
      href: "/tests",
      evidence: i.testScore !== null,
    },
    {
      key: "accuracy",
      label: "Accuracy",
      weight: 9,
      score: i.accuracy === null ? 0 : clamp((i.accuracy - 0.5) / 0.35),
      value: i.accuracy === null ? "not measured" : `${pct(i.accuracy)} right`,
      note: "50% scores nothing, 85%+ is full marks",
      href: "/tests/error-analysis",
      evidence: i.accuracy !== null,
    },
    {
      key: "practice",
      label: "Test practice",
      weight: 9,
      score: clamp(0.6 * clamp(i.tests30 / 4) + 0.4 * clamp(i.testedSubjects / 6)),
      value: `${i.tests30} in 30 days · ${i.testedSubjects}/6 subjects`,
      note: "one full test a week, every subject tested",
      href: "/tests",
      evidence: i.testCount > 0,
    },
    {
      key: "writing",
      label: "Answer writing",
      weight: 9,
      score: clamp(i.mainsEvidence / 20),
      value: `${Math.round(i.mainsEvidence)} pieces of evidence`,
      note: "Mains tests, essays and written answers",
      href: "/ai-insight/essay-checker",
      evidence: i.mainsEvidence > 0,
    },
    {
      key: "consistency",
      label: "Consistency",
      weight: 15,
      score: clamp(0.55 * clamp(i.hoursPerDay28 / 8) + 0.45 * clamp(i.loggedDays28 / 28)),
      value: `${i.hoursPerDay28.toFixed(1)}h a day · ${i.loggedDays28}/28 days`,
      note: "8h a day, every day logged",
      href: "/goals",
      evidence: i.loggedDays28 > 0,
    },
    {
      key: "wellbeing",
      label: "Confidence & calm",
      weight: 5,
      score: i.confidence === null ? 0 : clamp(0.6 * i.confidence + 0.4 * (1 - clamp((i.stress ?? 5) / 10))),
      value: i.confidence === null ? "not logged" : `confidence ${Math.round(i.confidence * 10)}/10 · stress ${Math.round(i.stress ?? 0)}/10`,
      note: "from your last ten mood check-ins",
      href: "/mood",
      evidence: i.confidence !== null,
    },
  ];
  const score = Math.round(parts.reduce((sum, p) => sum + p.weight * p.score, 0));
  const top = [...parts].sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score))[0];
  return {
    score,
    band: bandFor(score),
    parts,
    lever: top ? { key: top.key, label: top.label, points: Math.round(top.weight * (1 - top.score)) } : null,
  };
}
