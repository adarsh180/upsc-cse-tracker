import { CONCEPT_VALUE, LANES, ROADMAP, RUBRIC_STAGES, TOTAL_WEEKS, key, needsEvidence, stageForWeek, type Stage } from "@/lib/vault/roadmap";

/**
 * Every vault number, computed from logs and ticked items against the manual's
 * own bar — never against your past behaviour. Pure and deterministic: the same
 * records always give the same figures.
 */

export type ProgressRow = { itemKey: string; status: string; evidenceUrl: string | null; note: string | null; completedAt: string | null };
export type LogRow = { id: string; logDate: string; stage: number; readingMin: number; implementMin: number; adversarialMin: number; reviewMin: number; focus: string | null; note: string | null };
export type ArtifactRow = { id: string; stage: number; title: string; repoUrl: string | null; tag: string | null; p50Ms: number | null; p95Ms: number | null; peakRssMb: number | null; costPerReq: number | null; adrUrl: string | null; createdAt: string };
export type ReviewRow = { id: string; weekStart: string; tag: string | null; wins: string | null; risks: string | null; rubric: Record<string, number> | null };

export type Part = { key: string; label: string; weight: number; score: number; value: string; note: string; evidence: boolean };

const DAY = 86_400_000;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function mondayOf(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (x.getUTCDay() + 6) % 7;
  return new Date(x.getTime() - dow * DAY);
}

export type StageScore = {
  n: number;
  concept: number;
  lab: number;
  gate: number;
  score: number;
  passed: boolean;
  minutes: number;
};

export function itemDone(p: Map<string, ProgressRow>, itemKey: string) {
  const row = p.get(itemKey);
  if (!row || row.status !== "done") return false;
  return needsEvidence(itemKey) ? Boolean(row.evidenceUrl) : true;
}

export function scoreStage(stage: Stage, p: Map<string, ProgressRow>, minutes: number): StageScore {
  const s = stage.n;
  const concept = avg(stage.concepts.map((_, i) => CONCEPT_VALUE[p.get(key.concept(s, i))?.status ?? "todo"] ?? 0));
  const comp = stage.lab.components.map((_, i) => (itemDone(p, key.component(s, i)) ? 1 : 0));
  const mile = stage.lab.milestones.map((_, i) => (itemDone(p, key.milestone(s, i)) ? 1 : 0));
  const lab = 0.4 * avg(comp) + 0.6 * avg(mile);
  const targets = avg(stage.gate.targets.map((_, i) => (itemDone(p, key.target(s, i)) ? 1 : 0)));
  const evidence = avg(stage.gate.evidence.map((_, i) => (itemDone(p, key.evidence(s, i)) ? 1 : 0)));
  const failures = avg(stage.gate.failures.map((_, i) => (itemDone(p, key.failure(s, i)) ? 1 : 0)));
  const answered = avg(stage.gate.adversarial.map((_, i) => (itemDone(p, key.question(s, i)) ? 1 : 0)));
  const gate = 0.45 * targets + 0.25 * evidence + 0.2 * failures + 0.1 * answered;
  return {
    n: s,
    concept,
    lab,
    gate,
    score: 0.3 * concept + 0.25 * lab + 0.45 * gate,
    passed: targets === 1 && evidence === 1,
    minutes,
  };
}

/** Planned share of a stage that should be done by `week` (0..1). */
function plannedShare(stage: Stage, week: number) {
  const [a, b] = stage.weeks;
  if (week < a) return 0;
  if (week > b) return 1;
  return (week - a + 1) / (b - a + 1);
}

function settle(base: Record<string, number>) {
  const keys = Object.keys(base);
  const total = keys.reduce((s, k) => s + base[k], 0);
  const exact = keys.map((k) => (base[k] / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((s, x) => s + x, 0);
  for (const { i } of exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)) {
    if (left-- <= 0) break;
    out[i] += 1;
  }
  return Object.fromEntries(keys.map((k, i) => [k, out[i]]));
}

export function computeVault(input: {
  startDate: string;
  weeklyHourTarget: number;
  progress: ProgressRow[];
  logs: LogRow[];
  artifacts: ArtifactRow[];
  reviews: ReviewRow[];
  today?: Date;
}) {
  const today = input.today ?? new Date();
  const start = new Date(`${input.startDate}T00:00:00Z`);
  const daysIn = Math.floor((today.getTime() - start.getTime()) / DAY);
  const week = Math.max(1, Math.floor(daysIn / 7) + 1);
  const weeksElapsed = Math.max(0, Math.min(TOTAL_WEEKS, daysIn / 7));
  const p = new Map(input.progress.map((r) => [r.itemKey, r]));

  /* ── Time ─────────────────────────────────────────────────────────── */
  const minutesOf = (l: LogRow) => l.readingMin + l.implementMin + l.adversarialMin + l.reviewMin;
  const byDay = new Map<string, number>();
  const stageMinutes = new Map<number, number>();
  for (const l of input.logs) {
    byDay.set(l.logDate, (byDay.get(l.logDate) ?? 0) + minutesOf(l));
    stageMinutes.set(l.stage, (stageMinutes.get(l.stage) ?? 0) + minutesOf(l));
  }
  const totalMinutes = [...byDay.values()].reduce((s, x) => s + x, 0);
  const within = (days: number) => input.logs.filter((l) => today.getTime() - new Date(`${l.logDate}T00:00:00Z`).getTime() < days * DAY);
  const last28 = within(28);
  const hours28 = last28.reduce((s, l) => s + minutesOf(l), 0) / 60;
  const hoursPerWeek = hours28 / 4;
  const activeDays28 = new Set(last28.map((l) => l.logDate)).size;
  const mix = {
    reading: last28.reduce((s, l) => s + l.readingMin, 0),
    implementation: last28.reduce((s, l) => s + l.implementMin, 0),
    adversarial: last28.reduce((s, l) => s + l.adversarialMin, 0),
    review: last28.reduce((s, l) => s + l.reviewMin, 0),
  };
  const mixTotal = mix.reading + mix.implementation + mix.adversarial + mix.review;
  const mixShare = {
    reading: mixTotal ? mix.reading / mixTotal : 0,
    implementation: mixTotal ? mix.implementation / mixTotal : 0,
    adversarial: mixTotal ? mix.adversarial / mixTotal : 0,
    review: mixTotal ? mix.review / mixTotal : 0,
  };
  const c = ROADMAP.cadence;
  const cadenceFit = mixTotal
    ? clamp(1 - 0.5 * (Math.abs(mixShare.reading - c.reading) + Math.abs(mixShare.implementation - c.implementation) + Math.abs(mixShare.adversarial - c.adversarial) + Math.abs(mixShare.review - c.review)))
    : 0;
  let streak = 0;
  for (let d = byDay.has(dayKey(today)) ? 0 : 1; byDay.has(dayKey(new Date(today.getTime() - d * DAY))); d++) streak++;

  /* ── Stages ───────────────────────────────────────────────────────── */
  const stages = ROADMAP.stages.map((s) => scoreStage(s, p, stageMinutes.get(s.n) ?? 0));
  const actualProgress = avg(stages.map((s) => s.score));
  const expectedProgress = avg(ROADMAP.stages.map((s) => plannedShare(s, Math.min(TOTAL_WEEKS, weeksElapsed))));
  const plannedStage = stageForWeek(Math.min(week, TOTAL_WEEKS)) ?? ROADMAP.stages.at(-1)!;
  const currentStage = ROADMAP.stages.find((s) => !stages[s.n - 1].passed) ?? ROADMAP.stages.at(-1)!;
  const driftWeeks = Math.round((actualProgress - expectedProgress) * TOTAL_WEEKS * 10) / 10;
  const conceptCount = { todo: 0, learning: 0, explained: 0, proven: 0 } as Record<string, number>;
  for (const s of ROADMAP.stages) s.concepts.forEach((_, i) => (conceptCount[p.get(key.concept(s.n, i))?.status ?? "todo"] += 1));

  const capItems = [
    ...ROADMAP.capstone.budgets.map((_, i) => key.capBudget(i)),
    ...ROADMAP.capstone.drills.map((_, i) => key.capDrill(i)),
    ...ROADMAP.capstone.requirements.map((_, i) => key.capRequirement(i)),
  ];
  const capstone = avg(capItems.map((k) => (itemDone(p, k) ? 1 : 0)));

  /* ── Proficiency index (0–100) against the week-48 standard ──────── */
  const reachedStages = ROADMAP.stages.filter((s) => s.weeks[0] <= week || stages[s.n - 1].score > 0);
  const benchmarked = reachedStages.filter((s) => input.artifacts.some((a) => a.stage === s.n && a.p95Ms !== null)).length;
  const weeksForReviews = Math.max(1, Math.min(8, Math.floor(weeksElapsed)));
  const reviews8 = input.reviews.filter((r) => today.getTime() - new Date(`${r.weekStart}T00:00:00Z`).getTime() < 8 * 7 * DAY).length;
  const w = settle({ concepts: 20, labs: 15, gates: 25, hours: 15, cadence: 10, benchmarks: 5, reviews: 5, capstone: 5 });
  const parts: Part[] = [
    { key: "concepts", label: "Concept mastery", weight: w.concepts, score: avg(stages.map((s) => s.concept)), value: `${conceptCount.proven} proven · ${conceptCount.explained} explained of 104`, note: "proven in code > explained without notes > learning", evidence: conceptCount.todo < 104 },
    { key: "labs", label: "Labs shipped", weight: w.labs, score: avg(stages.map((s) => s.lab)), value: `${stages.filter((s) => s.lab >= 0.99).length}/13 labs complete`, note: "components built and every milestone met", evidence: stages.some((s) => s.lab > 0) },
    { key: "gates", label: "Gates proven", weight: w.gates, score: avg(stages.map((s) => s.gate)), value: `${stages.filter((s) => s.passed).length}/13 gates passed`, note: "targets and test evidence count only with an evidence link", evidence: stages.some((s) => s.gate > 0) },
    { key: "hours", label: "Weekly hours", weight: w.hours, score: clamp(hoursPerWeek / input.weeklyHourTarget), value: `${hoursPerWeek.toFixed(1)}h a week · ${activeDays28}/28 days`, note: `target ${input.weeklyHourTarget}h a week (manual: 15–20h focused)`, evidence: last28.length > 0 },
    { key: "cadence", label: "Cadence fit", weight: w.cadence, score: cadenceFit, value: mixTotal ? `${Math.round(mixShare.implementation * 100)}% building · ${Math.round(mixShare.adversarial * 100)}% breaking` : "no logged split", note: "20% reading · 55% implementation · 15% adversarial testing · 10% design review", evidence: mixTotal > 0 },
    { key: "benchmarks", label: "Benchmarks recorded", weight: w.benchmarks, score: reachedStages.length ? benchmarked / reachedStages.length : 0, value: `${benchmarked}/${reachedStages.length || 0} reached stages measured`, note: "p50/p95, memory and cost on every artifact", evidence: input.artifacts.length > 0 },
    { key: "reviews", label: "Sunday reviews", weight: w.reviews, score: clamp(reviews8 / weeksForReviews), value: `${reviews8} in the last ${weeksForReviews} week${weeksForReviews === 1 ? "" : "s"}`, note: "tag the repo, archive benchmarks, note open risks — every Sunday", evidence: input.reviews.length > 0 },
    { key: "capstone", label: "Capstone", weight: w.capstone, score: capstone, value: `${Math.round(capstone * 100)}% of EvidenceOps checks`, note: "latency, quality and reliability budgets plus fault drills", evidence: capstone > 0 },
  ];
  const proficiency = Math.round(parts.reduce((s, x) => s + x.weight * x.score, 0));
  const lever = [...parts].sort((a, b) => b.weight * (1 - b.score) - a.weight * (1 - a.score))[0];

  /* ── Rubric (manual page 50, 100 points) ─────────────────────────── */
  const adrs = input.artifacts.filter((a) => a.adrUrl).length;
  const rubric = ROADMAP.rubric.map((r) => {
    const mapped = RUBRIC_STAGES[r.key];
    const evidenceScore = mapped ? avg(mapped.map((n) => stages[n - 1].gate * 0.7 + stages[n - 1].lab * 0.3)) : clamp(0.5 * clamp(adrs / 13) + 0.5 * clamp(input.reviews.length / Math.max(1, Math.floor(weeksElapsed))));
    const self = input.reviews.at(-1)?.rubric?.[r.key];
    return { ...r, earned: Math.round(evidenceScore * r.points * 10) / 10, self: typeof self === "number" ? self : null };
  });
  const rubricTotal = Math.round(rubric.reduce((s, r) => s + r.earned, 0));

  /* ── Heatmaps ─────────────────────────────────────────────────────── */
  const calendar = Array.from({ length: 371 }, (_, i) => {
    const d = new Date(mondayOf(today).getTime() - (52 * 7 - i) * DAY);
    const k = dayKey(d);
    return { date: k, minutes: byDay.get(k) ?? 0, future: d.getTime() > today.getTime() };
  });
  const weekGrid = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const w0 = start.getTime() + i * 7 * DAY;
    const mins = input.logs
      .filter((l) => {
        const t = new Date(`${l.logDate}T00:00:00Z`).getTime();
        return t >= w0 && t < w0 + 7 * DAY;
      })
      .reduce((s, l) => s + minutesOf(l), 0);
    return { week: i + 1, plannedStage: stageForWeek(i + 1)?.n ?? 13, minutes: mins, past: i + 1 < week, current: i + 1 === week };
  });
  const conceptMatrix = ROADMAP.stages.map((s) => s.concepts.map((cc, i) => ({ title: cc.title, status: p.get(key.concept(s.n, i))?.status ?? "todo" })));

  /* ── Dependency map ───────────────────────────────────────────────── */
  const dag = LANES.map((lane) => ({
    ...lane,
    nodes: lane.stages.map((n) => ({ n, title: ROADMAP.stages[n - 1].title, score: stages[n - 1].score, passed: stages[n - 1].passed, planned: plannedShare(ROADMAP.stages[n - 1], weeksElapsed) })),
  }));

  /* ── Benchmarks over time ─────────────────────────────────────────── */
  const benchmarks = input.artifacts
    .filter((a) => a.p95Ms !== null || a.peakRssMb !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => ({ id: a.id, stage: a.stage, title: a.title, date: a.createdAt.slice(0, 10), p95: a.p95Ms, p50: a.p50Ms, rss: a.peakRssMb, cost: a.costPerReq }));

  return {
    week,
    weeksElapsed,
    startDate: input.startDate,
    plannedStage: plannedStage.n,
    currentStage: currentStage.n,
    stageEndsInDays: Math.max(0, Math.ceil((start.getTime() + plannedStage.weeks[1] * 7 * DAY - today.getTime()) / DAY)),
    actualProgress,
    expectedProgress,
    driftWeeks,
    pace: driftWeeks >= 0.5 ? "ahead" : driftWeeks <= -1 ? "behind" : "on track",
    hours: { total: totalMinutes / 60, perWeek: hoursPerWeek, target: input.weeklyHourTarget, activeDays28, streak },
    mix: mixShare,
    mixMinutes: mix,
    cadenceFit,
    stages,
    conceptCount,
    capstone,
    parts,
    proficiency,
    lever: lever ? { label: lever.label, points: Math.round(lever.weight * (1 - lever.score)) } : null,
    rubric,
    rubricTotal,
    calendar,
    weekGrid,
    conceptMatrix,
    dag,
    benchmarks,
  };
}

export type VaultMetrics = ReturnType<typeof computeVault>;
