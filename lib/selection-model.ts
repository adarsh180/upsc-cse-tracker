/**
 * Selection-odds model (pure, runs on server and client).
 *
 * UPSC CSE is three gates: Prelims → Mains → Interview. We estimate the
 * chance of clearing each gate from the user's own evidence, multiply them,
 * and compare against the national base rate. It is an estimate with an
 * explicit evidence strength, not a prophecy; every input is shown on the
 * dashboard and the levers let you see which habits move it.
 *
 * Calibration anchors (recent cycles, General category):
 *  - ~5.5 lakh appear in Prelims, ~14k reach Mains, ~2.8k interview, ~1k final.
 *  - Prelims GS cut-off ≈ 85–98/200 → we use 45% of max marks.
 *  - CSAT qualifies at 33%.
 *  - A full first pass of the syllabus is ≈ 2,200 focused hours.
 */

export const NATIONAL_BASE_RATE = 1000 / 550000; // ≈ 0.18%
const PRELIMS_CUTOFF = 0.45;
const MAINS_BASE = 2800 / 14000; // ≈ 20% of Mains candidates reach interview
const INTERVIEW_BASE = 1000 / 2800; // ≈ 36% of interviewees are recommended
const FULL_PASS_HOURS = 2200;

export type ModelInputs = {
  daysToPrelims: number;
  daysToMains: number;
  /** Prelims-relevant syllabus leaves (GS1–GS3) */
  prelimsLeaves: number;
  prelimsDone: number;
  /** Mains syllabus leaves (GS1–4, optional, essay) */
  mainsLeaves: number;
  mainsDone: number;
  hoursSoFar: number;
  /** Recency-weighted prelims test signal (fraction of max marks), or null */
  prelimsTestScore: number | null;
  prelimsTestCount: number;
  /** Distinct subjects covered by tests (breadth of evidence) */
  testedSubjects: number;
  observedAccuracy: number | null;
  observedAttemptRate: number | null;
  csatScore: number | null;
  mainsEvidence: number; // mains tests + essays + answer logs/10
  confidence: number | null; // 0..1 from mood log
};

export type Levers = {
  hoursPerDay: number;
  topicsPerDay: number;
  testsPerMonth: number;
  accuracy: number; // 0..1
  revisionPasses: number; // 0..4
};

export type StageResult = {
  key: "prelims" | "mains" | "interview";
  label: string;
  p: number;
  note: string;
};

export type ModelResult = {
  overall: number;
  low: number;
  high: number;
  multiple: number;
  evidence: number; // 0..1
  stages: StageResult[];
  breaksAt: StageResult["key"];
  projectedPrelimsScore: number; // out of 200
  cutoffScore: number; // out of 200
  coverageAtPrelims: number;
  coverageAtMains: number;
  hoursAtPrelims: number;
};

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

// Standard normal CDF (Abramowitz–Stegun 7.1.26).
function phi(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

export function observedLevers(inputs: ModelInputs, recent: { hoursPerDay: number; topicsPerDay: number; testsPerMonth: number; revisionPasses: number }): Levers {
  return {
    hoursPerDay: Math.round(recent.hoursPerDay * 4) / 4,
    topicsPerDay: Math.round(recent.topicsPerDay * 10) / 10,
    testsPerMonth: Math.round(recent.testsPerMonth),
    accuracy: Math.round((inputs.observedAccuracy ?? 0.65) * 100) / 100,
    revisionPasses: Math.round(recent.revisionPasses * 10) / 10,
  };
}

export function runModel(inputs: ModelInputs, levers: Levers): ModelResult {
  const daysPre = Math.max(0, inputs.daysToPrelims);
  const daysMains = Math.max(0, inputs.daysToMains);
  const totalLeaves = Math.max(1, inputs.mainsLeaves);

  // Effort projected to each exam.
  const hoursAtPrelims = inputs.hoursSoFar + levers.hoursPerDay * daysPre;
  const hoursAtMains = inputs.hoursSoFar + levers.hoursPerDay * daysMains;

  // Syllabus coverage from ticks, projected with the topics/day lever. Ticks
  // often lag real study, so coverage blends ticked share with hour-based
  // coverage (a full pass ≈ 2,200 h).
  const preRemaining = Math.max(0, inputs.prelimsLeaves - inputs.prelimsDone);
  const allRemaining = Math.max(1, totalLeaves - inputs.mainsDone);
  const preShare = preRemaining / allRemaining;
  const ticksAtPrelims = clamp((inputs.prelimsDone + levers.topicsPerDay * daysPre * preShare) / Math.max(1, inputs.prelimsLeaves));
  const ticksAtMains = clamp((inputs.mainsDone + levers.topicsPerDay * daysMains) / totalLeaves);
  const hoursCoverPre = clamp(hoursAtPrelims / FULL_PASS_HOURS);
  const hoursCoverMains = clamp(hoursAtMains / (FULL_PASS_HOURS * 1.35));
  const coverageAtPrelims = clamp(0.45 * ticksAtPrelims + 0.55 * hoursCoverPre);
  const coverageAtMains = clamp(0.45 * ticksAtMains + 0.55 * hoursCoverMains);

  // Retention: revision passes turn coverage into recall.
  const retention = 0.55 + 0.45 * clamp(levers.revisionPasses / 3);
  const knowledge = coverageAtPrelims * retention;

  // Prep-based expectation of the GS score (fraction of 200).
  const prepScore = 0.2 + 0.58 * knowledge;

  // Execution-based expectation from tests: attempt × net accuracy with −1/3
  // negative marking, nudged by future practice volume.
  const monthsLeft = daysPre / 30;
  const attempt = inputs.observedAttemptRate ?? 0.78;
  const practice = 0.05 * clamp((levers.testsPerMonth * monthsLeft) / 40);
  const execScore = clamp(attempt * (levers.accuracy - (1 - levers.accuracy) / 3) + practice);
  // Sectional tests overstate a full GS paper when few subjects are tested.
  const breadth = clamp(inputs.testedSubjects / 6);
  const testScore = inputs.prelimsTestScore === null ? null : clamp(execScore - 0.07 * (1 - breadth));

  const n = inputs.prelimsTestCount + Math.min(6, levers.testsPerMonth * Math.min(monthsLeft, 6) * 0.25);
  const wTest = testScore === null ? 0 : n / (n + 6);
  const expected = wTest * (testScore ?? 0) + (1 - wTest) * prepScore;

  const sigma = 0.055 + 0.07 * (1 - wTest);
  const pGs = phi((expected - PRELIMS_CUTOFF) / sigma);
  const pCsat = inputs.csatScore === null ? 0.93 : phi((inputs.csatScore - 0.33) / 0.07);
  const pPrelims = clamp(pGs * pCsat, 0.01, 0.97);

  // Mains: written depth — coverage at Mains, answer-writing evidence, hours.
  const writing = clamp(inputs.mainsEvidence / 12 + levers.testsPerMonth / 40);
  const mainsReadiness = 0.5 * coverageAtMains * retention + 0.3 * writing + 0.2 * clamp(hoursAtMains / (FULL_PASS_HOURS * 1.4));
  const pMains = clamp(MAINS_BASE * (0.3 + 1.6 * mainsReadiness), 0.03, 0.62);

  const pInterview = clamp(INTERVIEW_BASE * (0.88 + 0.3 * (inputs.confidence ?? 0.6)), 0.25, 0.5);

  const overall = pPrelims * pMains * pInterview;

  // Evidence strength widens/narrows the band.
  const evidence = clamp(
    0.18 +
      0.32 * (inputs.prelimsTestCount / (inputs.prelimsTestCount + 6)) +
      0.2 * clamp(inputs.hoursSoFar / 600) +
      0.15 * clamp(inputs.mainsDone / 400) +
      0.15 * clamp(inputs.mainsEvidence / 10),
  );
  const spread = 0.65 * (1 - evidence) + 0.15;
  const low = overall * (1 - spread);
  const high = Math.min(0.9, overall * (1 + spread * 1.4));

  const stages: StageResult[] = [
    {
      key: "prelims",
      label: "Prelims",
      p: pPrelims,
      note: `${Math.round(expected * 200)}/200 projected vs ~${Math.round(PRELIMS_CUTOFF * 200)} cut-off`,
    },
    {
      key: "mains",
      label: "Mains",
      p: pMains,
      note: `${Math.round(mainsReadiness * 100)}% written readiness`,
    },
    {
      key: "interview",
      label: "Interview",
      p: pInterview,
      note: "personality test, near base rate",
    },
  ];

  // The gate most likely to stop this attempt: Prelims while it is a coin
  // flip or worse, then Mains while written readiness is below the base rate.
  const breaksAt: StageResult["key"] = pPrelims < 0.55 ? "prelims" : pMains < MAINS_BASE ? "mains" : "interview";

  return {
    overall,
    low,
    high,
    multiple: overall / NATIONAL_BASE_RATE,
    evidence,
    stages,
    breaksAt,
    projectedPrelimsScore: Math.round(expected * 200),
    cutoffScore: Math.round(PRELIMS_CUTOFF * 200),
    coverageAtPrelims,
    coverageAtMains,
    hoursAtPrelims,
  };
}
